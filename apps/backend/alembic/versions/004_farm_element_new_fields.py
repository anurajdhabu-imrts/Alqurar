"""Add 19 named data fields to farm_elements (land, water, fire, air, ether)

Revision ID: 004
Revises: 003
Create Date: 2026-05-05
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Land
    op.add_column("farm_elements", sa.Column("soil_texture_slope",    sa.Text, nullable=True))
    op.add_column("farm_elements", sa.Column("ec_ph_npk",             sa.Text, nullable=True))
    op.add_column("farm_elements", sa.Column("historical_fertility",  sa.Text, nullable=True))
    # Water
    op.add_column("farm_elements", sa.Column("water_quality",         sa.Text, nullable=True))
    op.add_column("farm_elements", sa.Column("rainfall_history",      sa.Text, nullable=True))
    op.add_column("farm_elements", sa.Column("soil_water_retention",  sa.Text, nullable=True))
    op.add_column("farm_elements", sa.Column("crop_water_demand",     sa.Text, nullable=True))
    # Fire
    op.add_column("farm_elements", sa.Column("temp_rh_forecast",      sa.Text, nullable=True))
    op.add_column("farm_elements", sa.Column("sunlight_day_length",   sa.Text, nullable=True))
    op.add_column("farm_elements", sa.Column("degree_day_modeling",   sa.Text, nullable=True))
    op.add_column("farm_elements", sa.Column("pest_risk_forecast",    sa.Text, nullable=True))
    # Air
    op.add_column("farm_elements", sa.Column("rh_forecast",           sa.Text, nullable=True))
    op.add_column("farm_elements", sa.Column("wind_risk_mapping",     sa.Text, nullable=True))
    op.add_column("farm_elements", sa.Column("pollination_dependency",sa.Text, nullable=True))
    op.add_column("farm_elements", sa.Column("vpd_scoring",           sa.Text, nullable=True))
    # Ether
    op.add_column("farm_elements", sa.Column("panchang_lunar",            sa.Text, nullable=True))
    op.add_column("farm_elements", sa.Column("market_price_prediction",   sa.Text, nullable=True))
    op.add_column("farm_elements", sa.Column("harvest_window_risk",       sa.Text, nullable=True))
    op.add_column("farm_elements", sa.Column("internal_stress_indicators",sa.Text, nullable=True))


def downgrade() -> None:
    for col in [
        "internal_stress_indicators", "harvest_window_risk", "market_price_prediction", "panchang_lunar",
        "vpd_scoring", "pollination_dependency", "wind_risk_mapping", "rh_forecast",
        "pest_risk_forecast", "degree_day_modeling", "sunlight_day_length", "temp_rh_forecast",
        "crop_water_demand", "soil_water_retention", "rainfall_history", "water_quality",
        "historical_fertility", "ec_ph_npk", "soil_texture_slope",
    ]:
        op.drop_column("farm_elements", col)
