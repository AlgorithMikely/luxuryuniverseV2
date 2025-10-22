"""Add tiktok_username to User

Revision ID: 85b8ec43a134
Revises: 58894bb2d40b
Create Date: 2025-10-22 16:32:20.086270

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '85b8ec43a134'
down_revision: Union[str, Sequence[str], None] = '58894bb2d40b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('tiktok_username', sa.String(), nullable=True))
        batch_op.create_unique_constraint("uq_users_tiktok_username", ['tiktok_username'])

def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint("uq_users_tiktok_username", type_='unique')
        batch_op.drop_column('tiktok_username')
