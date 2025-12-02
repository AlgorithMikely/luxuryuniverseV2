"""Merge heads fix

Revision ID: merge_heads_fix
Revises: 20251124_061050, 0d35258860bf
Create Date: 2025-11-24 13:42:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'merge_heads_fix'
down_revision: Union[str, Sequence[str], None] = ('20251124_061050', '0d35258860bf')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
