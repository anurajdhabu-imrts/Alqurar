"""Add project_queries table

Revision ID: 006
Revises: 005
Create Date: 2026-07-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_queries",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("projectId", sa.String(), nullable=False, index=True),
        sa.Column("dateOfRfi", sa.String(), server_default=""),
        sa.Column("eotDescription", sa.Text(), server_default=""),
        sa.Column("queryDescription", sa.Text(), server_default=""),
        sa.Column("responseFromGic", sa.Text(), server_default=""),
        sa.Column("dateOfResponse", sa.String(), server_default=""),
        sa.Column("status", sa.String(), server_default="Open"),
        sa.Column("remarks", sa.Text(), server_default=""),
        sa.Column("createdAt", sa.String(), nullable=True),
        sa.Column("updatedAt", sa.String(), nullable=True),
    )
    op.create_index("ix_project_queries_projectId", "project_queries", ["projectId"])


def downgrade() -> None:
    op.drop_index("ix_project_queries_projectId", table_name="project_queries")
    op.drop_table("project_queries")
