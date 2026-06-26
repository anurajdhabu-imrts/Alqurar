"""Add delay_events table

Revision ID: 005
Revises: 004
Create Date: 2026-06-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "delay_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("projectId", sa.String(), nullable=False, index=True),
        sa.Column("ref", sa.String(), server_default=""),
        sa.Column("title", sa.String(), server_default=""),
        sa.Column("category", sa.String(), server_default=""),
        sa.Column("narrative", sa.Text(), server_default=""),
        sa.Column("cause", sa.String(), server_default="Employer"),
        sa.Column("clause", sa.String(), server_default=""),
        sa.Column("startDate", sa.String(), server_default=""),
        sa.Column("endDate", sa.String(), server_default=""),
        sa.Column("daysImpact", sa.Integer(), server_default="0"),
        sa.Column("criticalPath", sa.Boolean(), server_default=sa.false()),
        sa.Column("admissibility", sa.String(), server_default="Not assessed"),
        sa.Column("aiConfidence", sa.Integer(), server_default="0"),
        sa.Column("reviewStatus", sa.String(), server_default="Pending"),
        sa.Column("chronology", sa.JSON(), nullable=True),
        sa.Column("sources", sa.JSON(), nullable=True),
        sa.Column("createdAt", sa.String(), nullable=True),
        sa.Column("updatedAt", sa.String(), nullable=True),
    )
    op.create_index("ix_delay_events_projectId", "delay_events", ["projectId"])


def downgrade() -> None:
    op.drop_index("ix_delay_events_projectId", table_name="delay_events")
    op.drop_table("delay_events")
