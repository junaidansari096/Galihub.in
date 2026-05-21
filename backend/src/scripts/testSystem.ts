const BASE_URL = 'http://localhost:5000/api';

async function request(endpoint: string, options: any = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await response.json() as any;
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return data;
}

async function runTests() {
  console.log('⚡ Starting End-to-End System Tests via direct HTTP requests...\n');

  let userToken = '';
  let adminToken = '';
  let uploadedGaaliId = '';
  let uploadedGaaliSlug = '';
  const testUsername = `tester_${Math.floor(Math.random() * 10000)}`;

  // 1. SIGNUP TEST
  try {
    console.log('1. Testing User Registration...');
    const signupRes = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        username: testUsername,
        email: `${testUsername}@test.com`,
        password: 'testpassword123',
        region: 'Delhi'
      })
    });
    console.log(`✅ Success: Registered user "${signupRes.user.username}" with role "${signupRes.user.role}"`);
    userToken = signupRes.token;
  } catch (err: any) {
    console.error('❌ Sign Up test failed:', err.message);
    process.exit(1);
  }

  // 2. PROFILE PROFILE SYNC TEST
  try {
    console.log('\n2. Testing User Profile Verification...');
    const profileRes = await request('/auth/profile', {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    console.log(`✅ Success: Fetched profile. Points: ${profileRes.user.points}, Reputation: ${profileRes.user.reputation}`);
  } catch (err: any) {
    console.error('❌ Profile test failed:', err.message);
    process.exit(1);
  }

  // 3. UPLOAD SLANG (AI MODERATION SCENARIO)
  const word = `Kalti_${Math.floor(Math.random() * 1000)}`;
  try {
    console.log('\n3. Testing Slang Upload (AI Scan & Queue)...');
    const uploadRes = await request('/gaalis/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        word,
        meaning: 'To slip away silently or escape from a situation.',
        emotionalMeaning: 'Used in casual Mumbai slang to leave a boring conversation or place.',
        exampleSentence: 'Chal bhai, yahan se kalti maar! (Let\'s slip away from here, bro!)',
        originRegion: 'Maharashtra',
        language: 'Hinglish',
        severity: 'MILD',
        tags: ['casual', 'mumbai', 'escape']
      })
    });

    console.log(`✅ Success: Uploaded "${word}". Status: ${uploadRes.gaali.status}. AI Score: ${uploadRes.gaali.aiToxicityScore}`);
    uploadedGaaliId = uploadRes.gaali.id;
    uploadedGaaliSlug = uploadRes.gaali.slug;
  } catch (err: any) {
    console.error('❌ Upload test failed:', err.message);
    process.exit(1);
  }

  // 4. ADMIN LOGIN
  try {
    console.log('\n4. Testing Administrator Login...');
    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'superadmin@gaalihub.com',
        password: 'password123'
      })
    });
    console.log(`✅ Success: Logged in as Admin: ${adminLogin.user.username} (${adminLogin.user.role})`);
    adminToken = adminLogin.token;
  } catch (err: any) {
    console.error('❌ Admin login test failed:', err.message);
    process.exit(1);
  }

  // 5. MODERATION QUEUE & APPROVAL
  try {
    console.log('\n5. Testing Moderation Queue and manual review approval...');
    const queueRes = await request('/admin/queue', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    const itemInQueue = queueRes.queue.find((item: any) => item.id === uploadedGaaliId);

    if (itemInQueue) {
      console.log(`✅ Success: Found slang "${itemInQueue.word}" in Admin review queue.`);
    } else {
      throw new Error('Uploaded slang not found in moderation queue!');
    }

    // Approve the slang
    const reviewRes = await request('/admin/review', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        gaaliId: uploadedGaaliId,
        action: 'APPROVE',
        reason: 'Verified clean cultural slang.'
      })
    });

    console.log(`✅ Success: Manual review completed: ${reviewRes.message}`);
  } catch (err: any) {
    console.error('❌ Moderation review test failed:', err.message);
    process.exit(1);
  }

  // 6. PUBLIC LOOKUP, LIKE, AND COMMENT
  try {
    console.log('\n6. Testing public search, view increments, ratings, and comments...');
    
    // Get details
    const detailRes = await request(`/gaalis/${uploadedGaaliSlug}`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    console.log(`✅ Success: Retrieved approved slang "${detailRes.gaali.word}". Views: ${detailRes.gaali.views}`);

    // Like slang
    const likeRes = await request(`/gaalis/${uploadedGaaliId}/like`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    console.log(`✅ Success: Slang rated. New Likes: ${likeRes.likes}, Dislikes: ${likeRes.dislikes}`);

    // Add comment
    const commentRes = await request(`/gaalis/${uploadedGaaliId}/comment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        content: 'This is a very common phrase in colleges!'
      })
    });
    console.log(`✅ Success: Added comment. Comment ID: ${commentRes.comment.id}, Author: ${commentRes.comment.user.username}`);
  } catch (err: any) {
    console.error('❌ Interaction test failed:', err.message);
    process.exit(1);
  }

  // 7. SYSTEM STATS & AUDIT LOGS
  try {
    console.log('\n7. Verify Admin Statistics & Audit trail...');
    const stats = await request('/admin/stats', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    console.log(`✅ Success: System stats loaded. Total approved slangs: ${stats.stats.totalSlangs}`);

    const logs = await request('/admin/logs', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    const lastLog = logs.logs[0];
    console.log(`✅ Success: Audit log found. Last Action: ${lastLog.actionType}, Admin: ${lastLog.admin.username}`);
  } catch (err: any) {
    console.error('❌ Admin verification failed:', err.message);
    process.exit(1);
  }

  console.log('\n✨ ALL END-TO-END SYSTEM TESTS PASSED SUCCESSFULLY! ✨');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('💥 Test run crashed:', err);
  process.exit(1);
});
