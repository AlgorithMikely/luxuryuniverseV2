"""Add viewer stats to users

Revision ID: add_viewer_stats
Revises: merge_heads_fix
Create Date: 2025-11-24 19:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_viewer_stats'
down_revision = 'merge_heads_fix'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('lifetime_likes_sent', sa.BigInteger(), server_default='0', nullable=True))
    op.add_column('users', sa.Column('lifetime_gifts_sent', sa.BigInteger(), server_default='0', nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'lifetime_gifts_sent')
    op.drop_column('users', 'lifetime_likes_sent')
