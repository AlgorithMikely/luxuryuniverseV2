"""
Add role attributes to achievement definitions

Revision ID: add_role_attributes
Revises: add_gamification_schema
Create Date: 2025-11-25 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_role_attributes'
down_revision = 'add_gamification_schema'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('achievement_definitions', sa.Column('role_color', sa.String(), nullable=True))
    op.add_column('achievement_definitions', sa.Column('role_icon', sa.String(), nullable=True))

def downgrade():
    op.drop_column('achievement_definitions', 'role_icon')
    op.drop_column('achievement_definitions', 'role_color')
