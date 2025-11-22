"""Add file_hash to submissions

Revision ID: add_file_hash
Revises: smart_zone_fields
Create Date: 2025-11-21 16:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_file_hash'
down_revision: Union[str, Sequence[str], None] = 'smart_zone_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('submissions', sa.Column('file_hash', sa.String(), nullable=True))
    op.create_index(op.f('ix_submissions_file_hash'), 'submissions', ['file_hash'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_submissions_file_hash'), table_name='submissions')
    op.drop_column('submissions', 'file_hash')
