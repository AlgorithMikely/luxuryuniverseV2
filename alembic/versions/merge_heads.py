"""Merge heads

Revision ID: merge_heads
Revises: add_file_hash, 0d35258860bf
Create Date: 2025-11-21 16:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'merge_heads'
down_revision: Union[str, Sequence[str], None] = ('add_file_hash', '9c7b5a085ce0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
