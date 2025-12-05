"""add_check_constraints_for_balances

Revision ID: fc8b1de28da7
Revises: 7a49c3cb4e25
Create Date: 2025-12-04 06:04:28.947183

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fc8b1de28da7'
down_revision: Union[str, Sequence[str], None] = '7a49c3cb4e25'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add check constraint to users table for credit_balance >= 0
    op.create_check_constraint(
        "check_user_credit_balance_positive",
        "users",
        "credit_balance >= 0"
    )
    
    # Add check constraint to reviewer_wallets table for balance_usd >= 0
    op.create_check_constraint(
        "check_reviewer_wallet_balance_positive",
        "reviewer_wallets",
        "balance_usd >= 0"
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Remove check constraint from reviewer_wallets table
    op.drop_constraint(
        "check_reviewer_wallet_balance_positive",
        "reviewer_wallets",
        type_="check"
    )

    # Remove check constraint from users table
    op.drop_constraint(
        "check_user_credit_balance_positive",
        "users",
        type_="check"
    )
