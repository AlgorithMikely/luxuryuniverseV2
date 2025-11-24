"""Add achievements schema

Revision ID: 20251124_061050
Revises: add_gamification_schema
Create Date: 2025-11-24 06:10:50.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251124_061050'
down_revision = 'add_gamification_schema'
branch_labels = None
depends_on = None

def upgrade():
    # 1. Add gamification_stats to users
    # We use sa.JSON which maps to JSON/JSONB on Postgres and Text on SQLite
    op.add_column('users', sa.Column('gamification_stats', sa.JSON(), nullable=True))

    # 2. Add tier and is_hidden to achievement_definitions
    op.add_column('achievement_definitions', sa.Column('tier', sa.Integer(), server_default='1', nullable=False))
    op.add_column('achievement_definitions', sa.Column('is_hidden', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('achievement_definitions', sa.Column('role_color', sa.String(), nullable=True))
    op.add_column('achievement_definitions', sa.Column('role_icon', sa.String(), nullable=True))


def downgrade():
    op.drop_column('achievement_definitions', 'role_icon')
    op.drop_column('achievement_definitions', 'role_color')
    op.drop_column('achievement_definitions', 'is_hidden')
    op.drop_column('achievement_definitions', 'tier')
    op.drop_column('users', 'gamification_stats')
