"""
Add gamification tables and columns

Revision ID: add_gamification_schema
Revises: 7e401dc950bb
Create Date: 2025-11-24 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_gamification_schema'
down_revision = '7e401dc950bb'
branch_labels = None
depends_on = None

def upgrade():
    # 1. USERS Table Additions
    op.add_column('users', sa.Column('discord_user_id', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('lifetime_live_likes', sa.BigInteger(), server_default='0', nullable=True))
    op.add_column('users', sa.Column('lifetime_diamonds', sa.BigInteger(), server_default='0', nullable=True))
    op.add_column('users', sa.Column('total_submissions_graded', sa.Integer(), server_default='0', nullable=True))
    op.add_column('users', sa.Column('average_review_score', sa.Numeric(precision=4, scale=2), server_default='0.00', nullable=True))
    op.add_column('users', sa.Column('discord_msg_count', sa.BigInteger(), server_default='0', nullable=True))
    op.add_column('users', sa.Column('discord_voice_mins', sa.BigInteger(), server_default='0', nullable=True))

    # 2. LIVE SESSIONS Table
    op.create_table('live_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('tiktok_room_id', sa.String(length=255), nullable=True),
        sa.Column('max_concurrent_viewers', sa.Integer(), server_default='0', nullable=True),
        sa.Column('total_likes', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('total_diamonds', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('status', sa.String(), server_default='LIVE', nullable=True),
        sa.Column('start_time', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # 3. SUBMISSIONS Table Additions
    op.add_column('submissions', sa.Column('review_score', sa.Numeric(precision=4, scale=2), nullable=True))
    op.add_column('submissions', sa.Column('poll_result_w_percent', sa.Integer(), nullable=True))
    op.add_column('submissions', sa.Column('average_concurrent_viewers', sa.Integer(), nullable=True))

    # 4. ACHIEVEMENT DEFINITIONS Table
    op.create_table('achievement_definitions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('display_name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('threshold_value', sa.BigInteger(), nullable=False),
        sa.Column('discord_role_id', sa.String(length=255), nullable=True),
        sa.Column('icon_url', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
    )

    # 5. USER ACHIEVEMENTS Table
    op.create_table('user_achievements',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('achievement_id', sa.String(), nullable=True),
        sa.Column('unlocked_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('discord_sync_status', sa.String(), server_default='PENDING', nullable=True),
        sa.ForeignKeyConstraint(['achievement_id'], ['achievement_definitions.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'achievement_id', name='uq_user_achievement')
    )

def downgrade():
    op.drop_table('user_achievements')
    op.drop_table('achievement_definitions')
    op.drop_column('submissions', 'average_concurrent_viewers')
    op.drop_column('submissions', 'poll_result_w_percent')
    op.drop_column('submissions', 'review_score')
    op.drop_table('live_sessions')
    op.drop_column('users', 'discord_voice_mins')
    op.drop_column('users', 'discord_msg_count')
    op.drop_column('users', 'average_review_score')
    op.drop_column('users', 'total_submissions_graded')
    op.drop_column('users', 'lifetime_diamonds')
    op.drop_column('users', 'lifetime_live_likes')
    op.drop_column('users', 'discord_user_id')
