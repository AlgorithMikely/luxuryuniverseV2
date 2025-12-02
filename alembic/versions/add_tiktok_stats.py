"""Add TikTok comment and share stats

Revision ID: add_tiktok_stats
Revises: add_viewer_stats
Create Date: 2025-11-24 19:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_tiktok_stats'
down_revision = 'add_viewer_stats'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('lifetime_tiktok_comments', sa.BigInteger(), server_default='0', nullable=True))
    op.add_column('users', sa.Column('lifetime_tiktok_shares', sa.BigInteger(), server_default='0', nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'lifetime_tiktok_shares')
    op.drop_column('users', 'lifetime_tiktok_comments')
