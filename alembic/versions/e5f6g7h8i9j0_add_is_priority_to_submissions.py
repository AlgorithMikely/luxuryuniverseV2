"""add is_priority to submissions

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2025-11-20 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e5f6g7h8i9j0'
down_revision = 'd4e5f6g7h8i9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_priority column to submissions
    op.add_column('submissions', sa.Column('is_priority', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('submissions', 'is_priority')
