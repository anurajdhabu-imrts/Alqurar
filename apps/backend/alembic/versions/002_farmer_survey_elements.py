"""Add must_change_password to users; create farmers, surveys, farm_elements tables

Revision ID: 002
Revises: 001
Create Date: 2026-05-04
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users: add must_change_password ───────────────────────────────────────
    op.add_column(
        "users",
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default="false"),
    )

    # ── farmers ───────────────────────────────────────────────────────────────
    op.create_table(
        "farmers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("atp_id", sa.String(60), nullable=False, unique=True),

        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("alternate_phone", sa.String(20), nullable=True),

        # Identity
        sa.Column("pan_number", sa.String(20), nullable=True),
        sa.Column("aadhaar_number", sa.String(20), nullable=True),

        # Photo URLs
        sa.Column("farmer_photo_url", sa.Text, nullable=True),
        sa.Column("pan_card_photo_url", sa.Text, nullable=True),
        sa.Column("aadhaar_card_photo_url", sa.Text, nullable=True),

        # Location
        sa.Column("village", sa.String(100), nullable=False),
        sa.Column("hobli", sa.String(100), nullable=False),
        sa.Column("taluka", sa.String(100), nullable=False),
        sa.Column("district", sa.String(100), nullable=False),
        sa.Column("state", sa.String(100), nullable=False),

        # Admin
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_farmers_user_id", "farmers", ["user_id"])
    op.create_index("ix_farmers_atp_id", "farmers", ["atp_id"])
    op.create_index("ix_farmers_organization_id", "farmers", ["organization_id"])

    # ── surveys ───────────────────────────────────────────────────────────────
    op.create_table(
        "surveys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "farmer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("farmers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("survey_number", sa.String(100), nullable=False),
        sa.Column("survey_name", sa.String(150), nullable=True),
        sa.Column("total_area", sa.Numeric(10, 4), nullable=False),
        sa.Column("area_unit", sa.String(20), nullable=False, server_default="guntha"),
        sa.Column("soil_type", sa.String(100), nullable=True),
        sa.Column("center_latitude", sa.Float, nullable=True),
        sa.Column("center_longitude", sa.Float, nullable=True),
        sa.Column("boundary_geojson", postgresql.JSONB, nullable=True),
        sa.Column("water_source", sa.String(50), nullable=True),
        sa.Column("irrigation_method", sa.String(50), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_surveys_farmer_id", "surveys", ["farmer_id"])

    # ── farm_elements ─────────────────────────────────────────────────────────
    op.create_table(
        "farm_elements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "survey_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("surveys.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),

        # Land
        sa.Column("land_survey_number", sa.String(100), nullable=True),
        sa.Column("soil_report_source", sa.String(20), nullable=True),
        sa.Column("soil_report_url", sa.Text, nullable=True),
        sa.Column("drainage_status", sa.String(20), nullable=True),
        sa.Column("row_spacing", sa.Numeric(8, 2), nullable=True),
        sa.Column("plant_spacing", sa.Numeric(8, 2), nullable=True),
        sa.Column("spacing_unit", sa.String(20), nullable=True),
        sa.Column("land_custom_1", sa.Text, nullable=True),
        sa.Column("land_custom_2", sa.Text, nullable=True),
        sa.Column("land_custom_3", sa.Text, nullable=True),

        # Water
        sa.Column("water_source_type", sa.String(30), nullable=True),
        sa.Column("water_report_source", sa.String(20), nullable=True),
        sa.Column("water_report_url", sa.Text, nullable=True),
        sa.Column("water_availability", sa.String(20), nullable=True),
        sa.Column("water_output", sa.String(50), nullable=True),
        sa.Column("water_custom_1", sa.Text, nullable=True),

        # Fire
        sa.Column("sowing_date", sa.Date, nullable=True),
        sa.Column("crop_selection", sa.String(100), nullable=True),
        sa.Column("crop_season", sa.String(20), nullable=True),
        sa.Column("cultivation_method", sa.String(30), nullable=True),
        sa.Column("nutrient_preference", sa.String(30), nullable=True),
        sa.Column("crop_variety", sa.String(100), nullable=True),

        # Air
        sa.Column("bee_box_presence", sa.Boolean, nullable=True),
        sa.Column("crop_canopy_density", sa.String(20), nullable=True),
        sa.Column("pollination_confidence", sa.String(20), nullable=True),
        sa.Column("air_custom_1", sa.Text, nullable=True),
        sa.Column("air_custom_2", sa.Text, nullable=True),
        sa.Column("air_custom_3", sa.Text, nullable=True),

        # Ether
        sa.Column("farmer_intent", sa.String(30), nullable=True),
        sa.Column("lunar_alignment", sa.Boolean, nullable=True),
        sa.Column("previous_crop_result", sa.String(20), nullable=True),
        sa.Column("biodynamic_toggle", sa.Boolean, nullable=True),
        sa.Column("yield_expected_type", sa.String(30), nullable=True),
        sa.Column("ether_custom_1", sa.Text, nullable=True),

        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),

        sa.UniqueConstraint("survey_id", name="uq_farm_elements_survey_id"),
    )
    op.create_index("ix_farm_elements_survey_id", "farm_elements", ["survey_id"])


def downgrade() -> None:
    op.drop_table("farm_elements")
    op.drop_table("surveys")
    op.drop_table("farmers")
    op.drop_column("users", "must_change_password")
