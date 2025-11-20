"""add_priority_value_and_open_queue_tiers

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2025-11-19 16:20:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6g7'
down_revision = ('5223aef398a5', 'a1b2c3d4e5f6')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add priority_value to submissions
    op.add_column('submissions', sa.Column('priority_value', sa.Integer(), nullable=False, server_default='0'))
    
    # Add open_queue_tiers to review_sessions
    op.add_column('review_sessions', sa.Column('open_queue_tiers', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    
    # Initialize open_queue_tiers for existing sessions
    op.execute("UPDATE review_sessions SET open_queue_tiers = '[0, 5, 10, 15, 20, 25]' WHERE open_queue_tiers IS NULL")
    
    # Set not null constraint
    if op.get_context().dialect.name != 'sqlite':
        op.alter_column('review_sessions', 'open_queue_tiers', nullable=False, server_default='[0, 5, 10, 15, 20, 25]')
    else:
        with op.batch_alter_table('review_sessions') as batch_op:
            batch_op.alter_column('open_queue_tiers', nullable=False, server_default='[0, 5, 10, 15, 20, 25]')


def downgrade() -> None:
    op.drop_column('review_sessions', 'open_queue_tiers')
    op.drop_column('submissions', 'priority_value')
