import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function generateDbPass(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let rand = "";
  for (let i = 0; i < 12; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `JT_${rand}!2026`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = body?.token?.trim();
    const region = body?.region?.trim() || "ap-southeast-1"; // Default Singapore / Asia
    const projectName = body?.projectName?.trim() || "jobtrack";
    let targetOrgId = body?.organizationId?.trim();

    if (!token) {
      return NextResponse.json(
        { error: "Supabase Personal Access Token is required." },
        { status: 400 }
      );
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // 1. Fetch or resolve organization
    let targetOrgSlug = "";

    if (targetOrgId === "__CREATE_NEW_ORG__") {
      // User explicitly requested to create a brand new organization
      // Note: Supabase Management API POST /v1/organizations only accepts { name: string }
      const createOrgRes = await fetch("https://api.supabase.com/v1/organizations", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "JobTrack Org" }),
      });

      if (!createOrgRes.ok) {
        const createOrgErr = await createOrgRes.text();
        return NextResponse.json(
          { error: `Could not create organization: ${createOrgErr}` },
          { status: createOrgRes.status }
        );
      }

      const newOrg = await createOrgRes.json();
      targetOrgId = newOrg.id;
      targetOrgSlug = newOrg.slug || newOrg.id;
    } else if (targetOrgId) {
      // User specified an existing organization ID
      const orgsRes = await fetch("https://api.supabase.com/v1/organizations", { headers });
      if (orgsRes.ok) {
        const orgs: Array<{ id: string; name: string; slug?: string }> = await orgsRes.json();
        const found = orgs.find((o) => o.id === targetOrgId || o.slug === targetOrgId);
        if (found) {
          targetOrgSlug = found.slug || found.id;
          targetOrgId = found.id;
        } else {
          targetOrgSlug = targetOrgId;
        }
      } else {
        targetOrgSlug = targetOrgId;
      }
    } else {
      // No organization specified: inspect user's account
      const orgsRes = await fetch("https://api.supabase.com/v1/organizations", { headers });
      if (!orgsRes.ok) {
        const errText = await orgsRes.text();
        return NextResponse.json(
          { error: `Failed to authenticate with Supabase: ${errText}` },
          { status: orgsRes.status }
        );
      }

      const orgs: Array<{ id: string; name: string; slug?: string }> = await orgsRes.json();

      if (orgs.length > 0) {
        targetOrgId = orgs[0].id;
        targetOrgSlug = orgs[0].slug || orgs[0].id;
      } else {
        // Zero organizations exist -> auto-create default organization
        const createOrgRes = await fetch("https://api.supabase.com/v1/organizations", {
          method: "POST",
          headers,
          body: JSON.stringify({ name: "JobTrack Org" }),
        });

        if (!createOrgRes.ok) {
          const createOrgErr = await createOrgRes.text();
          return NextResponse.json(
            { error: `Could not create default organization: ${createOrgErr}` },
            { status: createOrgRes.status }
          );
        }

        const newOrg = await createOrgRes.json();
        targetOrgId = newOrg.id;
        targetOrgSlug = newOrg.slug || newOrg.id;
      }
    }

    // 2. Generate a secure database password
    const dbPass = generateDbPass();

    // 3. Create the project via Supabase Management API
    const projectPayload: Record<string, any> = {
      name: projectName,
      organization_slug: targetOrgSlug || targetOrgId,
      db_pass: dbPass,
      region: region,
    };

    const createProjectRes = await fetch("https://api.supabase.com/v1/projects", {
      method: "POST",
      headers,
      body: JSON.stringify(projectPayload),
    });

    if (!createProjectRes.ok) {
      const errText = await createProjectRes.text();
      let errData: any = {};
      try {
        errData = JSON.parse(errText);
      } catch {
        errData = { message: errText };
      }
      const errMessage = errData.message || createProjectRes.statusText || errText;

      let userFacingError = `Failed to create project: ${errMessage}`;
      if (createProjectRes.status === 400 && errMessage.toLowerCase().includes("quota")) {
        userFacingError = "Supabase Free Tier quota reached (maximum 2 active projects). Please use one of your existing projects or pause an unused one in your Supabase dashboard.";
      } else if (createProjectRes.status === 403) {
        userFacingError = "Access token lacks 'projects:write' permission. Please generate a token with full access.";
      }

      return NextResponse.json(
        { error: userFacingError, details: errData },
        { status: createProjectRes.status }
      );
    }

    const projectData = await createProjectRes.json();

    return NextResponse.json({
      success: true,
      project: {
        id: projectData.id,
        name: projectData.name,
        status: projectData.status || "COMING_UP",
        region: projectData.region,
      },
      organizationId: targetOrgId,
    });
  } catch (error: any) {
    console.error("Error creating project via API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error creating project." },
      { status: 500 }
    );
  }
}
