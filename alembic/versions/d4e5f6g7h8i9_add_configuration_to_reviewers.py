"""add configuration to reviewers

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2025-12-12 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd4e5f6g7h8i9'
down_revision = 'c3d4e5f6g7h8'
branch_labels = None
depends_on = None


def upgrade():
    # Add configuration column to reviewers
    # Use JSON type for Postgres, with fallback to Text for others if needed (though here we use postgresql.JSON)
    op.add_column('reviewers', sa.Column('configuration', postgresql.JSON(astext_type=sa.Text()), nullable=True))


def downgrade():
    op.drop_column('reviewers', 'configuration')
