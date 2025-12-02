"""add_global_config

Revision ID: add_global_config
Revises: 
Create Date: 2024-11-25 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from custom_types import JSON

# revision identifiers, used by Alembic.
revision = 'add_global_config'
down_revision = ('17902fdc8faf', 'smart_zone_fields') # Merging heads
branch_labels = None
depends_on = None

def upgrade():
    # Create GlobalConfig table
    op.create_table('global_configs',
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('value', JSON(), nullable=True),
        sa.PrimaryKeyConstraint('key')
    )

def downgrade():
    op.drop_table('global_configs')
