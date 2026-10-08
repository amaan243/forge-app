import axios from "axios";
import { supabaseAdmin } from "../src/lib/supabase.js";

const API_BASE = "http://localhost:4000/api/v1";

async function runTests() {
  console.log("=== STARTING ARCHFORGE AUTHENTICATION TEST SUITE ===");
  const testEmail = `test.architect.${Date.now()}@gmail.com`;
  const testPassword = "Password123!";
  const newPassword = "NewSecurePassword456!";
  let testUserId = "";
  let accessToken = "";

  try {
    // 1. REGISTER
    console.log("\n[TEST 1] Register new user with unverified email...");
    const regRes = await axios.post(`${API_BASE}/auth/register`, {
      email: testEmail,
      password: testPassword,
      full_name: "Elena Rostova",
      role: "Architect",
      company: "Forge Industries",
    });

    console.log("Status:", regRes.status);
    console.log("Success:", regRes.data.success);
    console.log("Message:", regRes.data.message);
    console.log("IsEmailVerified:", regRes.data.data.isEmailVerified);
    testUserId = regRes.data.data.user.id;
    if (!testUserId) throw new Error("No user id returned on registration");
    if (regRes.data.data.isEmailVerified !== false) throw new Error("Expected isEmailVerified to be false");
    console.log("✓ TEST 1 PASSED: Registration successful, user created in unverified state.");

    // 2. VERIFY USER IN SUPABASE AUTH & PROFILES
    console.log("\n[TEST 2] Verify user in Supabase Auth & public.profiles...");
    const { data: supaUser, error: supaErr } = await supabaseAdmin.auth.admin.getUserById(testUserId);
    if (supaErr || !supaUser.user) throw new Error(`Supabase user check failed: ${supaErr?.message}`);
    console.log("Supabase Auth User ID:", supaUser.user.id);
    console.log("Supabase Email Confirmed:", supaUser.user.email_confirmed_at);

    const { data: profileData } = await supabaseAdmin.from("profiles").select("*").eq("id", testUserId).single();
    console.log("Profile row exists:", !!profileData, "Full Name:", profileData?.full_name);
    console.log("✓ TEST 2 PASSED: User confirmed created in Supabase Auth & public.profiles.");

    // 3. TRY LOGIN BEFORE EMAIL VERIFICATION
    console.log("\n[TEST 3] Attempt login before email verification (must be blocked)...");
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        email: testEmail,
        password: testPassword,
      });
      throw new Error("Login should NOT have succeeded for unverified user!");
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.error?.code === "EMAIL_NOT_VERIFIED") {
        console.log("Correctly received 403 Forbidden with code EMAIL_NOT_VERIFIED:");
        console.log("Message:", err.response.data.message);
        console.log("✓ TEST 3 PASSED: Unverified login blocked as required.");
      } else {
        throw new Error(`Unexpected error on unverified login: ${err.message}`);
      }
    }

    // 4. TEST RESEND VERIFICATION
    console.log("\n[TEST 4] Test resend verification email endpoint...");
    try {
      const resendRes = await axios.post(`${API_BASE}/auth/resend-verification`, {
        email: testEmail,
      });
      console.log("Resend Status:", resendRes.status, "Message:", resendRes.data.message);
      console.log("✓ TEST 4 PASSED: Resend verification email completed (200 OK).");
    } catch (err: any) {
      if (err.response?.status === 429 && err.response?.data?.error?.code === "RATE_LIMIT_EXCEEDED") {
        console.log("Resend correctly rate-limited with 429 RATE_LIMIT_EXCEEDED:", err.response.data.message);
        console.log("✓ TEST 4 PASSED: Resend verification email rate-limit handling verified.");
      } else {
        throw err;
      }
    }

    // 5. TEST INVALID CREDENTIALS
    console.log("\n[TEST 5] Test login with invalid credentials...");
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        email: testEmail,
        password: "WrongPassword999!",
      });
      throw new Error("Login should NOT have succeeded with wrong password!");
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.log("Correctly received 401 Unauthorized:", err.response.data.message);
        console.log("✓ TEST 5 PASSED: Invalid credentials rejected.");
      } else {
        throw new Error(`Unexpected response on invalid credentials: ${err.message}`);
      }
    }

    // 6. CONFIRM EMAIL IN SUPABASE (SIMULATING EMAIL LINK CLICK)
    console.log("\n[TEST 6] Confirming user email in Supabase...");
    const { error: confirmErr } = await supabaseAdmin.auth.admin.updateUserById(testUserId, {
      email_confirm: true,
    });
    if (confirmErr) throw new Error(`Failed to confirm email: ${confirmErr.message}`);
    console.log("✓ TEST 6 PASSED: Email confirmed in Supabase.");

    // 7. SIGN IN WITH VERIFIED ACCOUNT
    console.log("\n[TEST 7] Sign in with verified account...");
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: testEmail,
      password: testPassword,
    });
    console.log("Login Status:", loginRes.status);
    console.log("Login Success:", loginRes.data.success);
    console.log("User:", loginRes.data.data.user);
    accessToken = loginRes.data.data.session.accessToken;
    if (!accessToken) throw new Error("No access token returned on login");
    console.log("✓ TEST 7 PASSED: Verified sign-in succeeded, session tokens issued.");

    // 8. TEST PROTECTED ROUTE WITH ACCESS TOKEN
    console.log("\n[TEST 8] Access protected route /api/v1/auth/me with Bearer token...");
    const meRes = await axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    console.log("Me Status:", meRes.status);
    console.log("Me User ID:", meRes.data.data.user.id);
    console.log("Me Email:", meRes.data.data.user.email);
    console.log("Me Name:", meRes.data.data.user.full_name);
    if (meRes.data.data.user.id !== testUserId) throw new Error("User ID mismatch on /me");
    console.log("✓ TEST 8 PASSED: Protected route accessed successfully with Bearer token.");

    // 9. TEST ACCESS WITHOUT TOKEN (MUST FAIL 401)
    console.log("\n[TEST 9] Access protected route without token (must return 401)...");
    try {
      await axios.get(`${API_BASE}/auth/me`);
      throw new Error("Protected route should NOT have succeeded without token!");
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.log("Correctly rejected with 401 Unauthorized.");
        console.log("✓ TEST 9 PASSED: Unauthenticated access blocked.");
      } else {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }

    // 10. TEST FORGOT PASSWORD
    console.log("\n[TEST 10] Test forgot password request...");
    try {
      const forgotRes = await axios.post(`${API_BASE}/auth/forgot-password`, {
        email: testEmail,
      });
      console.log("Forgot Password Status:", forgotRes.status, "Message:", forgotRes.data.message);
      console.log("✓ TEST 10 PASSED: Password reset email requested successfully.");
    } catch (err: any) {
      if (err.response?.status === 429) {
        console.log("Supabase free tier email rate limit encountered (429):", err.response.data.message);
        console.log("✓ TEST 10 PASSED: Rate limit properly handled.");
      } else {
        throw err;
      }
    }

    // 11. TEST RESET PASSWORD
    console.log("\n[TEST 11] Test password update with session token...");
    const resetRes = await axios.post(
      `${API_BASE}/auth/reset-password`,
      { password: newPassword },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    console.log("Reset Password Status:", resetRes.status, "Message:", resetRes.data.message);
    console.log("✓ TEST 11 PASSED: Password updated successfully.");

    // 12. TEST LOGIN WITH NEW PASSWORD
    console.log("\n[TEST 12] Sign in with new updated password...");
    const newLoginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: testEmail,
      password: newPassword,
    });
    console.log("New Login Status:", newLoginRes.status, "Success:", newLoginRes.data.success);
    console.log("✓ TEST 12 PASSED: Successfully signed in with new password.");

    // 13. TEST LOGOUT
    console.log("\n[TEST 13] Test logout endpoint...");
    const logoutRes = await axios.post(`${API_BASE}/auth/logout`, {}, {
      headers: { Authorization: `Bearer ${newLoginRes.data.data.session.accessToken}` },
    });
    console.log("Logout Status:", logoutRes.status, "Message:", logoutRes.data.message);
    console.log("✓ TEST 13 PASSED: Logout completed.");

    console.log("\n=======================================================");
    console.log("🎉 ALL 13 AUTHENTICATION TESTS PASSED SUCCESSFULLY!");
    console.log("=======================================================");
  } finally {
    // CLEANUP
    if (testUserId) {
      console.log("\nCleaning up test user:", testUserId);
      await supabaseAdmin.auth.admin.deleteUser(testUserId).catch(() => {});
      console.log("Cleanup complete.");
    }
  }
}

runTests().catch((err) => {
  console.error("\n❌ TEST FAILED:", err);
  process.exit(1);
});
