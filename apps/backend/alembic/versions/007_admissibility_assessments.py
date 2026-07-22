"""Add admissibility_assessments table

Revision ID: 007
Revises: 006
Create Date: 2026-07-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "admissibility_assessments",
        sa.Column("projectId", sa.String(), primary_key=True),
        sa.Column("content", sa.JSON(), nullable=True),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("status", sa.String(), server_default=""),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("createdAt", sa.String(), nullable=True),
        sa.Column("updatedAt", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("admissibility_assessments")
