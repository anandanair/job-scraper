-- Resume Style Settings Table Migration
-- Stores the user's active resume design / template preferences.

CREATE TABLE IF NOT EXISTS "public"."resume_style_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "name" "text" NOT NULL DEFAULT 'Modern Tech',
    "preset" "text" NOT NULL DEFAULT 'modern_tech',
    "is_active" boolean DEFAULT true,
    "theme_config" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "public"."resume_style_settings" OWNER TO "postgres";
ALTER TABLE "public"."resume_style_settings" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."resume_style_settings" TO "anon";
GRANT ALL ON TABLE "public"."resume_style_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."resume_style_settings" TO "service_role";

-- Seed with initial default Modern Tech theme
INSERT INTO "public"."resume_style_settings" ("name", "preset", "is_active", "theme_config")
VALUES (
    'Modern Tech',
    'modern_tech',
    true,
    '{
      "preset": "modern_tech",
      "typography": {
        "fontFamily": "Helvetica",
        "fontSizeScale": "normal",
        "lineSpacing": "normal"
      },
      "colors": {
        "primary": "#1976D2",
        "secondary": "#455A64",
        "text": "#212121",
        "light": "#757575",
        "divider": "#2C3E50"
      },
      "layout": {
        "headerAlignment": "left",
        "showDividers": true,
        "dividerThickness": 1,
        "skillsLayout": "grid_3col",
        "margins": "normal",
        "sectionOrder": [
          "summary",
          "skills",
          "experience",
          "education",
          "projects",
          "certifications",
          "languages"
        ]
      }
    }'::jsonb
)
ON CONFLICT DO NOTHING;
