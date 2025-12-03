import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict
import random
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

import models
import schemas
from services import broadcast as broadcast_service

logger = logging.getLogger(__name__)

# Constants
GIVEAWAY_COOLDOWN_MINUTES = 5 # Moved to Reviewer model but used as fallback

# Default Goal Definitions
DEFAULT_GOAL_TYPES = {
    "LIKES": {
        "base_target": 10000,
        "description": "Reach {target} Likes for a Free Skip!",
        "ticket_weight": 1
    },
    "SHARES": {
        "base_target": 250,
        "description": "Reach {target} Shares for a Free Skip!",
        "ticket_weight": 1
    },
    "GIFTS": {
        "base_target": 1000,
        "description": "Drop {target} Diamonds for a Free Skip!",
        "ticket_weight": 1
    },
    "COMMENTS": {
        "base_target": 500,
        "description": "Chat {target} times for a Free Skip!",
        "ticket_weight": 1
    }
}

def get_reviewer_goal_settings(reviewer: models.Reviewer) -> dict:
    """
    Merges global defaults with reviewer-specific overrides.
    """
    if not reviewer.configuration:
        return DEFAULT_GOAL_TYPES
        
    custom_settings = reviewer.configuration.get("giveaway_settings", {})
    if not custom_settings:
        return DEFAULT_GOAL_TYPES
        
    merged = DEFAULT_GOAL_TYPES.copy()
    for key, val in custom_settings.items():
        if key in merged:
            merged[key] = merged[key].copy()
            merged[key].update(val)
            
    return merged

def _initialize_goal_config(goal_type: str, settings: dict, viewer_count: int = 0) -> dict:
    """Helper to create a fresh goal config."""
    base_target = settings[goal_type]["base_target"]
    target = _get_dynamic_goal_target(base_target, viewer_count)
    desc = settings[goal_type]["description"].format(target=target)
    
    return {
        "type": goal_type,
        "target": target,
        "current": 0,
        "description": desc,
        "is_active": True,
        "cooldown_end": None,
        "tickets": {} # username -> count
    }

async def get_giveaway_states(db: AsyncSession, reviewer_id: int) -> List[schemas.GiveawayState]:
    """
    Returns the state of ALL community goals. Initializes them if missing.
    """
    reviewer = await db.get(models.Reviewer, reviewer_id)
    if not reviewer:
        return []
    
    config = reviewer.configuration or {}
    goals_config = config.get("community_goals", {})
    
    goal_settings = get_reviewer_goal_settings(reviewer)
    needs_save = False
    
    # Ensure all types exist
    for g_type in DEFAULT_GOAL_TYPES.keys():
        if g_type not in goals_config:
            goals_config[g_type] = _initialize_goal_config(g_type, goal_settings)
            needs_save = True
            
    if needs_save:
        config["community_goals"] = goals_config
        reviewer.configuration = config
        flag_modified(reviewer, "configuration")
        await db.commit()
        
    states = []
    for g_type, g_config in goals_config.items():
        states.append(schemas.GiveawayState(
            type=g_type,
            is_active=g_config.get("is_active", True),
            progress=g_config.get("current", 0),
            target=g_config.get("target", 1000),
            cooldown_end=datetime.fromisoformat(g_config["cooldown_end"]) if g_config.get("cooldown_end") else None,
            description=g_config.get("description")
        ))
        
    return states

async def update_community_goal_progress(db: AsyncSession, reviewer_id: int, event_type: str, amount: int, user_id: str = None, username: str = None):
    """
    Updates the specific community goal progress.
    """
    reviewer = await db.get(models.Reviewer, reviewer_id)
    if not reviewer:
        return

    if not reviewer.configuration:
        reviewer.configuration = {}
    
    config = dict(reviewer.configuration)
    goals_config = config.get("community_goals", {})
    
    # Initialize if missing (lazy init)
    if event_type not in goals_config:
        goal_settings = get_reviewer_goal_settings(reviewer)
        if event_type in goal_settings:
             goals_config[event_type] = _initialize_goal_config(event_type, goal_settings)
        else:
            return # Invalid type
            
    goal_config = goals_config[event_type]

    # Check Cooldown
    if goal_config.get("cooldown_end"):
        cooldown_end = datetime.fromisoformat(goal_config["cooldown_end"])
        if datetime.now(timezone.utc) < cooldown_end:
            return

    # Calculate Progress
    progress_amount = amount
    goal_config["current"] = goal_config.get("current", 0) + progress_amount
    
    # Track User Tickets
    if user_id:
        tickets = goal_config.get("tickets", {})
        current_tickets = tickets.get(user_id, 0)
        tickets[user_id] = current_tickets + progress_amount
        goal_config["tickets"] = tickets

    # Check for Goal Completion
    target = goal_config.get("target", 1000)
    if goal_config["current"] >= target:
        await trigger_giveaway_lottery(db, reviewer, event_type, goal_config)
    else:
        goals_config[event_type] = goal_config
        config["community_goals"] = goals_config
        reviewer.configuration = config
        flag_modified(reviewer, "configuration")
        await db.commit()
        
        # Broadcast Update (Single Goal)
        state = schemas.GiveawayState(
            type=event_type,
            is_active=goal_config.get("is_active", True),
            progress=goal_config["current"],
            target=target,
            cooldown_end=None,
            description=goal_config.get("description")
        )
        # We might want to emit a specific event or just the generic update
        await broadcast_service.emit_giveaway_update(reviewer_id, state.model_dump(mode='json'))

async def trigger_giveaway_lottery(db: AsyncSession, reviewer: models.Reviewer, goal_type: str, goal_config: dict):
    """
    Selects a winner, resets THIS goal type, and sets cooldown.
    """
    tickets_map = goal_config.get("tickets", {})
    
    from services import queue_service
    
    # 1. Get Free Queue
    pending_queue = await queue_service.get_pending_queue(db, reviewer.id)
    free_queue = [s for s in pending_queue if s.priority_value == 0]
    
    if not free_queue:
        logger.warning(f"Giveaway triggered for {goal_type} but Free Queue is empty. No winner selected.")
        winner_id = None
        winner_user_id = None
    else:
        # Pick random from free queue (ignoring tickets/contributors as requested)
        random_sub = random.choice(free_queue)
        winner_id = random_sub.user.username # For display
        winner_user_id = random_sub.user.id # For logic
        winner_tickets = 0 
            
        # Announce Winner
        if winner_id:
            winner_data = {
                "username": winner_id,
                "tickets": winner_tickets,
                "prize": "Free Skip",
                "goal_type": goal_type
            }
            await broadcast_service.emit_giveaway_winner(reviewer.id, winner_data)
            await queue_service.apply_free_skip(db, reviewer.id, winner_user_id)

    # --- RESET GOAL ---
    goal_settings = get_reviewer_goal_settings(reviewer)
    type_info = goal_settings[goal_type]
    
    # Get Viewer Count for Scaling
    stmt = select(models.LiveSession).filter(
        models.LiveSession.user_id == reviewer.user_id, 
        models.LiveSession.status == 'LIVE'
    ).order_by(models.LiveSession.start_time.desc())
    result = await db.execute(stmt)
    live_session = result.scalars().first()
    viewer_count = live_session.max_concurrent_viewers if live_session else 0
    
    base_target = type_info["base_target"]
    next_target = _get_dynamic_goal_target(base_target, viewer_count)
    description = type_info["description"].format(target=next_target)
    
    # Set Cooldown
    cooldown_end = datetime.now(timezone.utc) + timedelta(minutes=GIVEAWAY_COOLDOWN_MINUTES)
    
    # Reset Config
    goal_config["current"] = 0
    goal_config["target"] = next_target
    goal_config["description"] = description
    goal_config["tickets"] = {}
    goal_config["cooldown_end"] = cooldown_end.isoformat()
    
    # Save
    config = dict(reviewer.configuration)
    if "community_goals" not in config:
        config["community_goals"] = {}
        
    config["community_goals"][goal_type] = goal_config
    reviewer.configuration = config
    flag_modified(reviewer, "configuration")
    await db.commit()
    
    # Broadcast New State
    state = schemas.GiveawayState(
        type=goal_type,
        is_active=True,
        progress=0,
        target=next_target,
        cooldown_end=cooldown_end,
        description=description
    )
    await broadcast_service.emit_giveaway_update(reviewer.id, state.model_dump(mode='json'))

def _get_dynamic_goal_target(base_target: int, viewer_count: int) -> int:
    """
    Scales the base target based on viewer count.
    """
    multiplier = 1.0
    
    if viewer_count > 1000:
        multiplier = 5.0
    elif viewer_count > 500:
        multiplier = 3.0
    elif viewer_count > 200:
        multiplier = 2.0
    elif viewer_count > 50:
        multiplier = 1.5
        
    return int(base_target * multiplier)

async def batch_update_community_goal_progress(db: AsyncSession, reviewer_id: int, event_type: str, total_amount: int, user_updates: dict[str, int]):
    """
    Updates the community goal progress in batch.
    """
    reviewer = await db.get(models.Reviewer, reviewer_id)
    if not reviewer:
        return

    if not reviewer.configuration:
        reviewer.configuration = {}
    
    config = dict(reviewer.configuration)
    goals_config = config.get("community_goals", {})
    
    # Initialize if missing
    if event_type not in goals_config:
        goal_settings = get_reviewer_goal_settings(reviewer)
        if event_type in goal_settings:
             goals_config[event_type] = _initialize_goal_config(event_type, goal_settings)
        else:
            return

    goal_config = goals_config[event_type]

    # Check Cooldown
    if goal_config.get("cooldown_end"):
        cooldown_end = datetime.fromisoformat(goal_config["cooldown_end"])
        if datetime.now(timezone.utc) < cooldown_end:
            return

    # Update Total Progress
    goal_config["current"] = goal_config.get("current", 0) + total_amount
    
    # Update User Tickets
    tickets = goal_config.get("tickets", {})
    for user_id, amount in user_updates.items():
        current_tickets = tickets.get(user_id, 0)
        tickets[user_id] = current_tickets + amount
    goal_config["tickets"] = tickets

    # Check for Goal Completion
    target = goal_config.get("target", 1000)
    if goal_config["current"] >= target:
        await trigger_giveaway_lottery(db, reviewer, event_type, goal_config)
    else:
        goals_config[event_type] = goal_config
        config["community_goals"] = goals_config
        reviewer.configuration = config
        flag_modified(reviewer, "configuration")
        await db.commit()
        
        # Broadcast Update
        state = schemas.GiveawayState(
            type=event_type,
            is_active=goal_config.get("is_active", True),
            progress=goal_config["current"],
            target=target,
            cooldown_end=None,
            description=goal_config.get("description")
        )
        await broadcast_service.emit_giveaway_update(reviewer_id, state.model_dump(mode='json'))

async def extend_cooldown(db: AsyncSession, reviewer_id: int, minutes: int):
    """
    Extends the cooldown for all community goals.
    """
    reviewer = await db.get(models.Reviewer, reviewer_id)
    if not reviewer:
        return

    if not reviewer.configuration:
        return
    
    config = dict(reviewer.configuration)
    goals_config = config.get("community_goals", {})
    
    if not goals_config:
        return

    needs_save = False
    now = datetime.now(timezone.utc)
    new_cooldown_end = now + timedelta(minutes=minutes)

    for g_type, g_config in goals_config.items():
        current_end_str = g_config.get("cooldown_end")
        
        if current_end_str:
            current_end = datetime.fromisoformat(current_end_str)
            if current_end > now:
                # Extend existing
                updated_end = current_end + timedelta(minutes=minutes)
                g_config["cooldown_end"] = updated_end.isoformat()
            else:
                # Expired, set new
                g_config["cooldown_end"] = new_cooldown_end.isoformat()
        else:
            # No cooldown, set new
            g_config["cooldown_end"] = new_cooldown_end.isoformat()
            
        goals_config[g_type] = g_config
        needs_save = True

    if needs_save:
        config["community_goals"] = goals_config
        reviewer.configuration = config
        flag_modified(reviewer, "configuration")
        await db.commit()
        
        # We could broadcast updates, but might be too noisy for just a cooldown extension?
        # Let's broadcast to be safe so UI updates.
        for g_type, g_config in goals_config.items():
             state = schemas.GiveawayState(
                type=g_type,
                is_active=g_config.get("is_active", True),
                progress=g_config.get("current", 0),
                target=g_config.get("target", 1000),
                cooldown_end=datetime.fromisoformat(g_config["cooldown_end"]),
                description=g_config.get("description")
            )
             await broadcast_service.emit_giveaway_update(reviewer_id, state.model_dump(mode='json'))
