import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { action, email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const emailClean = email.trim().toLowerCase();

    if (action === "login") {
      const { data: user, error } = await supabase
        .from("crm_users")
        .select("id, name, email, password")
        .eq("email", emailClean)
        .single();

      if (error || !user) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }

      if (user.password !== password) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    }

    if (action === "signup") {
      if (!name) {
        return NextResponse.json({ error: "Name is required for sign up" }, { status: 400 });
      }

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from("crm_users")
        .select("id")
        .eq("email", emailClean)
        .maybeSingle();

      if (existingUser) {
        return NextResponse.json({ error: "Email already registered" }, { status: 400 });
      }

      const { data: newUser, error: insertError } = await supabase
        .from("crm_users")
        .insert({
          name: name.trim(),
          email: emailClean,
          password: password
        })
        .select("id, name, email")
        .single();

      if (insertError) {
        throw insertError;
      }

      return NextResponse.json({
        success: true,
        user: newUser
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Auth Error:", error);
    return NextResponse.json(
      { error: error.message || "Authentication failed" },
      { status: 500 }
    );
  }
}
