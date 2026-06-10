"""Add land_ownership, intended_crop, previous_crop_history, nearest_landmark to surveys

Revision ID: 003
Revises: 002
Create Date: 2026-05-05
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("surveys", sa.Column("land_ownership", sa.String(30), nullable=True))
    op.add_column("surveys", sa.Column("intended_crop", JSONB, nullable=True))
    op.add_column("surveys", sa.Column("previous_crop_history", sa.Text, nullable=True))
    op.add_column("surveys", sa.Column("nearest_landmark", sa.String(200), nullable=True))
    # Widen free-text infra fields that were capped at 50
    op.alter_column("surveys", "water_source", type_=sa.String(100))
    op.alter_column("surveys", "irrigation_method", type_=sa.String(100))


def downgrade() -> None:
    op.drop_column("surveys", "nearest_landmark")
    op.drop_column("surveys", "previous_crop_history")
    op.drop_column("surveys", "intended_crop")
    op.drop_column("surveys", "land_ownership")
    op.alter_column("surveys", "water_source", type_=sa.String(50))
    op.alter_column("surveys", "irrigation_method", type_=sa.String(50))
