from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional
from sqlalchemy.orm import selectinload
import datetime
import models
import schemas
import security
from database import get_db

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/metrics/revenue")
async def get_revenue_metrics(
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get platform revenue metrics grouped by reviewer.
    Only accessible by admins.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Aggregate revenue by reviewer
    stmt = select(
        models.TransactionLedger.reviewer_id,
        func.sum(models.TransactionLedger.platform_revenue_usd).label("total_platform_revenue"),
        func.sum(models.TransactionLedger.usd_earned).label("total_reviewer_payout"),
        func.count(models.TransactionLedger.id).label("transaction_count")
    ).where(
        models.TransactionLedger.reviewer_id.isnot(None)
    ).group_by(
        models.TransactionLedger.reviewer_id
    )

    result = await db.execute(stmt)
    rows = result.all()

    metrics = []
    for row in rows:
        reviewer_id = row.reviewer_id
        # Fetch reviewer name
        reviewer_res = await db.execute(select(models.Reviewer).options(selectinload(models.Reviewer.user)).filter(models.Reviewer.id == reviewer_id))
        reviewer = reviewer_res.scalars().first()
        reviewer_name = reviewer.username if reviewer else f"Unknown ({reviewer_id})"

        metrics.append({
            "reviewer_id": reviewer_id,
            "reviewer_name": reviewer_name,
            "total_platform_revenue": float(row.total_platform_revenue or 0),
            "total_reviewer_payout": float(row.total_reviewer_payout or 0),
            "transaction_count": row.transaction_count
        })

    # Calculate Total Platform Revenue
    total_revenue = sum(m["total_platform_revenue"] for m in metrics)

    return {
        "total_platform_revenue": total_revenue,
        "breakdown": metrics
    }

@router.get("/metrics/summary")
async def get_metrics_summary(
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    High-level dashboard summary: GMV, Net Revenue, Take Rate, Active Reviewers.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Not authorized")

    # 1. GMV & Net Revenue
    stmt_financials = select(
        func.sum(models.TransactionLedger.credits_spent).label("total_credits_spent"),
        func.sum(models.TransactionLedger.platform_revenue_usd).label("net_revenue"),
        func.sum(models.TransactionLedger.usd_earned).label("reviewer_payouts")
    ).where(models.TransactionLedger.action.in_(['skip', 'purchase'])) # Filter relevant actions

    financials = (await db.execute(stmt_financials)).one()
    
    # Calculate GMV (approx based on credit price, or sum of purchases if we tracked USD paid directly)
    # Using credits_spent * 0.01 for GMV of *spent* credits (Gross Volume)
    # Or should GMV be total purchases? Let's use Spent Volume for now as it reflects activity.
    gmv = float(financials.total_credits_spent or 0) * 0.01 
    net_revenue = float(financials.net_revenue or 0)
    reviewer_payouts = float(financials.reviewer_payouts or 0)
    
    take_rate = (net_revenue / gmv * 100) if gmv > 0 else 0
    net_margin = (net_revenue / gmv * 100) if gmv > 0 else 0 # Same as take rate in this simplified model

    # 2. Active Reviewers (last 30 days)
    thirty_days_ago = datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=30)
    stmt_active_reviewers = select(func.count(func.distinct(models.TransactionLedger.reviewer_id))).where(
        models.TransactionLedger.timestamp >= thirty_days_ago
    )
    active_reviewers = (await db.execute(stmt_active_reviewers)).scalar()

    return {
        "gmv": gmv,
        "net_revenue": net_revenue,
        "reviewer_payouts": reviewer_payouts,
        "take_rate": take_rate,
        "net_margin": net_margin,
        "active_reviewers": active_reviewers
    }

@router.get("/metrics/sessions")
async def get_session_metrics(
    page: int = 1,
    limit: int = 20,
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Session profitability metrics.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Not authorized")

    offset = (page - 1) * limit

    # Aggregate ledger by session
    stmt = select(
        models.TransactionLedger.session_id,
        func.sum(models.TransactionLedger.platform_revenue_usd).label("net_revenue"),
        func.sum(models.TransactionLedger.credits_spent).label("credits_spent"),
        func.count(models.TransactionLedger.id).label("transaction_count")
    ).where(
        models.TransactionLedger.session_id.isnot(None)
    ).group_by(
        models.TransactionLedger.session_id
    ).order_by(desc("net_revenue")).offset(offset).limit(limit)

    result = await db.execute(stmt)
    rows = result.all()

    session_metrics = []
    for row in rows:
        # Fetch session details
        session = (await db.execute(select(models.ReviewSession).filter(models.ReviewSession.id == row.session_id))).scalars().first()
        if not session:
            continue
            
        reviewer = (await db.execute(select(models.Reviewer).options(selectinload(models.Reviewer.user)).filter(models.Reviewer.id == session.reviewer_id))).scalars().first()
        reviewer_name = reviewer.username if reviewer else "Unknown"

        # Calculate Duration (approximate if not ended)
        start_time = session.created_at
        # We don't have end_time in ReviewSession model yet? 
        # Let's assume 2 hours if active, or calculate from last submission?
        # For now, let's just return raw revenue.
        
        session_metrics.append({
            "session_id": session.id,
            "session_name": session.name,
            "reviewer_name": reviewer_name,
            "date": start_time,
            "net_revenue": float(row.net_revenue or 0),
            "gmv": float(row.credits_spent or 0) * 0.01,
            "transaction_count": row.transaction_count
        })

    return session_metrics

@router.get("/metrics/reviewers")
async def get_reviewer_metrics(
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Reviewer performance leaderboard.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Not authorized")

    stmt = select(
        models.TransactionLedger.reviewer_id,
        func.sum(models.TransactionLedger.platform_revenue_usd).label("net_revenue"),
        func.sum(models.TransactionLedger.usd_earned).label("total_earnings"),
        func.count(models.TransactionLedger.id).label("transaction_count")
    ).where(
        models.TransactionLedger.reviewer_id.isnot(None)
    ).group_by(
        models.TransactionLedger.reviewer_id
    ).order_by(desc("net_revenue"))

    result = await db.execute(stmt)
    rows = result.all()

    reviewer_metrics = []
    for row in rows:
        reviewer = (await db.execute(select(models.Reviewer).options(selectinload(models.Reviewer.user)).filter(models.Reviewer.id == row.reviewer_id))).scalars().first()
        reviewer_name = reviewer.username if reviewer else "Unknown"

        reviewer_metrics.append({
            "reviewer_id": row.reviewer_id,
            "reviewer_name": reviewer_name,
            "net_revenue": float(row.net_revenue or 0),
            "total_earnings": float(row.total_earnings or 0),
            "transaction_count": row.transaction_count
        })

    return reviewer_metrics

@router.post("/ledger/search", response_model=schemas.LedgerSearchResult)
async def search_ledger(
    query: schemas.LedgerSearchQuery,
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Advanced search for transaction ledger.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Base query
    stmt = select(models.TransactionLedger).options(
        selectinload(models.TransactionLedger.user),
        selectinload(models.TransactionLedger.reviewer).selectinload(models.Reviewer.user)
    )

    # Filters
    if query.start_date:
        stmt = stmt.where(models.TransactionLedger.timestamp >= query.start_date)
    if query.end_date:
        stmt = stmt.where(models.TransactionLedger.timestamp <= query.end_date)
    
    if query.action_types:
        stmt = stmt.where(models.TransactionLedger.action.in_(query.action_types))
        
    if query.min_amount_usd is not None:
        stmt = stmt.where(models.TransactionLedger.usd_earned >= query.min_amount_usd)
    if query.max_amount_usd is not None:
        stmt = stmt.where(models.TransactionLedger.usd_earned <= query.max_amount_usd)
        
    if query.user_id:
        stmt = stmt.where(models.TransactionLedger.user_id == query.user_id)
    if query.reviewer_id:
        stmt = stmt.where(models.TransactionLedger.reviewer_id == query.reviewer_id)

    # Text Search (Username, Request ID, Reference ID)
    if query.search_term:
        term = f"%{query.search_term}%"
        # Join with User to search username
        # Note: We need to be careful with joins in async select if not explicit
        # But here we can use a subquery or just simple OR if we join
        
        # For simplicity and performance, let's search indexed columns first
        # searching meta_data is slow without GIN index, so we'll skip deep JSON search for now
        # unless it's a specific field we know.
        
        stmt = stmt.join(models.User, models.TransactionLedger.user_id == models.User.id, isouter=True)
        
        stmt = stmt.where(
            (models.TransactionLedger.request_id.ilike(term)) |
            (models.User.username.ilike(term)) |
            (models.TransactionLedger.action.ilike(term))
        )

    # Count total (before pagination)
    # We need a separate count query
    # This is a bit inefficient for complex queries, but standard for admin grids
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar()

    # Pagination
    offset = (query.page - 1) * query.limit
    stmt = stmt.order_by(desc(models.TransactionLedger.timestamp)).offset(offset).limit(query.limit)

    result = await db.execute(stmt)
    items = result.scalars().all()

    return {
        "total": total,
        "page": query.page,
        "limit": query.limit,
        "items": items
    }

@router.get("/platform-fees")
async def get_platform_fees(
    page: int = 1,
    limit: int = 50,
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get platform fees history.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Not authorized")

    offset = (page - 1) * limit
    stmt = select(models.PlatformFee).order_by(desc(models.PlatformFee.created_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()
    
    # Count total
    count_stmt = select(func.count()).select_from(models.PlatformFee)
    total = (await db.execute(count_stmt)).scalar()

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.get("/reviewers", response_model=List[schemas.UserProfile])
async def get_all_reviewers(
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all reviewers and admins/mods.
    Returns UserProfile objects which include roles.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Not authorized")

    from config import settings

    # Query Users who are reviewers OR admins
    stmt = select(models.User).options(
        selectinload(models.User.reviewer_profile).options(
            selectinload(models.Reviewer.payment_configs),
            selectinload(models.Reviewer.economy_configs)
        ),
        selectinload(models.User.achievements).selectinload(models.UserAchievement.achievement)
    )
    
    # We want users who have a reviewer profile OR are in the admin list
    # Note: Outer join is needed to include users without reviewer profile (admins)
    stmt = stmt.outerjoin(models.Reviewer, models.User.reviewer_profile)
    
    # Filter: Has reviewer profile OR is admin
    admin_ids = settings.ADMIN_DISCORD_IDS
    
    conditions = [models.Reviewer.id.isnot(None)]
    if admin_ids:
        conditions.append(models.User.discord_id.in_(admin_ids))
        
    stmt = stmt.where(
        (models.Reviewer.id.isnot(None)) | 
        (models.User.discord_id.in_(admin_ids) if admin_ids else False)
    )
    
    result = await db.execute(stmt)
    users = result.scalars().all()
    
    # Manually populate roles
    for user in users:
        roles = []
        if user.reviewer_profile:
            roles.append("reviewer")
        if user.discord_id and user.discord_id in admin_ids:
            roles.append("admin")
        # Add other roles if needed (e.g. moderator)
        
        user.roles = roles
        
    return users

@router.get("/discord-users")
async def get_discord_users(
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get cached Discord users.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Not authorized")

    stmt = select(models.DiscordUserCache)
    result = await db.execute(stmt)
    users = result.scalars().all()
    return users

@router.get("/discord/channels")
async def get_discord_channels(
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get available Discord channels.
    Note: This currently returns a static list or cached channels if available.
    For now, we'll return an empty list as we don't have a channel cache model.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Not authorized")

    # TODO: Implement Discord channel fetching via bot RPC or cache
    return []

@router.get("/tiktok-accounts")
async def get_tiktok_accounts(
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all monitored TikTok accounts.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Not authorized")

    stmt = select(models.TikTokAccount)
    result = await db.execute(stmt)
    accounts = result.scalars().all()
    return accounts

@router.get("/global-settings")
async def get_global_settings(
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get global application settings.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Not authorized")

    stmt = select(models.GlobalConfig)
    result = await db.execute(stmt)
    settings = result.scalars().all()
    
    # Convert list to dict for frontend
    settings_dict = {s.key: s.value for s in settings}
    return settings_dict
