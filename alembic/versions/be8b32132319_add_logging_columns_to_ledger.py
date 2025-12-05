"""add_logging_columns_to_ledger

Revision ID: be8b32132319
Revises: fc8b1de28da7
Create Date: 2025-12-04 06:06:10.241980

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'be8b32132319'
down_revision: Union[str, Sequence[str], None] = 'fc8b1de28da7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('transaction_ledger', sa.Column('request_id', sa.String(), nullable=True))
    op.add_column('transaction_ledger', sa.Column('ip_address', sa.String(), nullable=True))
    op.add_column('transaction_ledger', sa.Column('user_agent', sa.String(), nullable=True))
    op.create_index(op.f('ix_transaction_ledger_request_id'), 'transaction_ledger', ['request_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_transaction_ledger_request_id'), table_name='transaction_ledger')
    op.drop_column('transaction_ledger', 'user_agent')
    op.drop_column('transaction_ledger', 'ip_address')
    op.drop_column('transaction_ledger', 'request_id')
