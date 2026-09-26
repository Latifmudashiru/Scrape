import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET: Fetch all email templates
export async function GET() {
  try {
    const { data: templates, error } = await supabase
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: templates || []
    });
  } catch (error: any) {
    console.error("Fetch Templates Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST: Save (insert or update) an email template
export async function POST(request: NextRequest) {
  try {
    const { id, name, subject, body } = await request.json();

    if (!name || !subject || !body) {
      return NextResponse.json({ error: "name, subject, and body are required" }, { status: 400 });
    }

    let result;
    if (id) {
      // Update
      const { data, error } = await supabase
        .from("email_templates")
        .update({ name, subject, body })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      // Insert
      const { data, error } = await supabase
        .from("email_templates")
        .insert({ name, subject, body })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error("Save Template Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save template" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a template
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("email_templates")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Template deleted successfully"
    });
  } catch (error: any) {
    console.error("Delete Template Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete template" },
      { status: 500 }
    );
  }
}
