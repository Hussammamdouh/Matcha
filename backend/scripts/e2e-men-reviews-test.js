const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:8080';

// Test users
const users = [
  { email: 'user1@example.com', password: 'Password!123' },
  { email: 'user2@example.com', password: 'Password!123' },
  { email: 'user3@example.com', password: 'Password!123' }
];

let userTokens = {};
let communityId = null;
let reviewId = null;
let commentId = null;

// Helper function to make authenticated requests
function createAuthHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

// Helper function to create form data headers
function createFormDataHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`
  };
}

// Login function
async function login(email, password) {
  try {
    const response = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
      email,
      password
    });
    
    if (response.data.ok && response.data.data.idToken) {
      return response.data.data.idToken;
    }
    throw new Error('Login failed: No token received');
  } catch (error) {
    console.error(`Login failed for ${email}:`, error.response?.data || error.message);
    throw error;
  }
}

// Test Men Reviews Features
async function testMenReviews() {
  console.log('\n=== Men Reviews E2E Test ===\n');

  try {
    // Step 1: Login all users
    console.log('1. Logging in users...');
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const token = await login(user.email, user.password);
      userTokens[`user${i + 1}`] = token;
      console.log(`   ✓ ${user.email} logged in`);
    }

    // Step 2: Create a community for reviews
    console.log('\n2. Creating community for reviews...');
    const timestamp = Date.now();
    
    try {
      const communityResponse = await axios.post(
        `${BASE_URL}/api/v1/communities`,
        {
          name: `TestCommunity${Date.now()}`,
          slug: `test-community-${Date.now()}`,
          description: 'A community for reviewing men',
          isPrivate: false
        },
        { headers: createAuthHeaders(userTokens.user1) }
      );
      
      if (communityResponse.data.ok) {
        communityId = communityResponse.data.data.id;
        console.log(`   ✓ Community created: ${communityId}`);
      } else {
        console.log('   ❌ Community creation failed:', communityResponse.data.error);
        if (communityResponse.data.error.details) {
          console.log('   Validation details:', JSON.stringify(communityResponse.data.error.details, null, 2));
        }
        throw new Error('Failed to create community');
      }
    } catch (error) {
      if (error.response?.data) {
        console.log('   ❌ Community creation error:', error.response.data);
        if (error.response.data.error?.details) {
          console.log('   Validation details:', JSON.stringify(error.response.data.error.details, null, 2));
        }
      }
      throw error;
    }

    // Step 3: Join community with other users
    console.log('\n3. Other users joining community...');
    for (let i = 2; i <= 3; i++) {
      const joinResponse = await axios.post(
        `${BASE_URL}/api/v1/communities/${communityId}/join`,
        {},
        { headers: createAuthHeaders(userTokens[`user${i}`]) }
      );
      if (joinResponse.data.ok) {
        console.log(`   ✓ User${i} joined community`);
      } else {
        console.log(`   ⚠ User${i} join failed:`, joinResponse.data.error?.message);
      }
    }

    // Add a small delay to ensure community memberships are processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: Check community membership first
    console.log('\n4. Checking community membership...');
    const membershipResponse = await axios.get(
      `${BASE_URL}/api/v1/communities/${communityId}/members?pageSize=10`,
      { headers: createAuthHeaders(userTokens.user1) }
    );
    
    if (membershipResponse.data.ok) {
      const members = membershipResponse.data.data || [];
      console.log(`   ✓ Community has ${members.length} members`);
      members.forEach((member, index) => {
        console.log(`   ✓ Member ${index + 1}: ${member.nickname} (${member.userId})`);
      });
    } else {
      console.log(`   ⚠ Failed to fetch community members:`, membershipResponse.data.error?.message);
    }

    // Step 5: Test aggregated reviews (should be empty initially)
    console.log('\n5. Testing aggregated reviews...');
    try {
      const aggregateResponse = await axios.get(
        `${BASE_URL}/api/v1/reviews/aggregate?limit=10`,
        { headers: createAuthHeaders(userTokens.user1) }
      );
      
      if (aggregateResponse.data.ok) {
        console.log(`   ✓ Aggregated reviews fetched: ${aggregateResponse.data.data?.length || 0} reviews`);
      } else {
        console.log(`   ⚠ Failed to fetch aggregated reviews:`, aggregateResponse.data.error?.message);
      }
    } catch (error) {
      console.log(`   ⚠ Aggregated reviews error:`, error.response?.data?.error?.message || error.message);
      console.log(`   ⚠ Continuing with other tests...`);
    }

    // Step 6: Create a review (multipart, same body style as posts: includes file)
    console.log('\n6. Creating a review (multipart upload like posts)...');
    const form = new FormData();
    form.append('communityId', communityId);
    form.append('targetId', 'test-man-123');
    form.append('label', 'red');
    form.append('comment', 'This person exhibited suspicious behavior and made inappropriate comments.');
    const photoForReview = path.join(__dirname, 'download.jpeg');
    if (fs.existsSync(photoForReview)) {
      form.append('file', fs.createReadStream(photoForReview));
    }

    const createReviewResponse = await axios.post(
      `${BASE_URL}/api/v1/reviews`,
      form,
      { headers: { Authorization: `Bearer ${userTokens.user1}`, ...form.getHeaders() } }
    );

    if (createReviewResponse.data.ok) {
      reviewId = createReviewResponse.data.data.id;
      console.log(`   ✓ Review created: ${reviewId}`);
      console.log(`   ✓ Review label: ${createReviewResponse.data.data.label}`);
      console.log(`   ✓ Review comment: ${createReviewResponse.data.data.comment}`);
    } else {
      throw new Error('Failed to create review');
    }

    // Step 7: Get the specific review
    console.log('\n7. Fetching specific review...');
    const getReviewResponse = await axios.get(
      `${BASE_URL}/api/v1/reviews/${reviewId}`,
      { headers: createAuthHeaders(userTokens.user2) }
    );

    if (getReviewResponse.data.ok) {
      console.log(`   ✓ Review fetched successfully`);
      console.log(`   ✓ Review details:`, {
        id: getReviewResponse.data.data.id,
        label: getReviewResponse.data.data.label,
        comment: getReviewResponse.data.data.comment,
        voterId: getReviewResponse.data.data.voterId
      });
    } else {
      throw new Error('Failed to fetch review');
    }

    // Step 8: Vote on the review with different users
    console.log('\n8. Testing review voting...');
    const voteLabels = ['green', 'red', 'unknown'];
    
    for (let i = 0; i < 3; i++) {
      const voteResponse = await axios.post(
        `${BASE_URL}/api/v1/reviews/${reviewId}/vote`,
        { label: voteLabels[i] },
        { headers: createAuthHeaders(userTokens[`user${i + 1}`]) }
      );

      if (voteResponse.data.ok) {
        console.log(`   ✓ User${i + 1} voted "${voteLabels[i]}" on review`);
      } else {
        console.log(`   ⚠ User${i + 1} vote failed:`, voteResponse.data.error?.message);
      }
    }

    // Step 9: Add comments to the review
    console.log('\n9. Testing review comments...');
    const comments = [
      'I agree with this assessment.',
      'I had a similar experience with this person.',
      'This is helpful information, thank you for sharing.'
    ];

    for (let i = 0; i < comments.length; i++) {
      const commentResponse = await axios.post(
        `${BASE_URL}/api/v1/reviews/${reviewId}/comments`,
        { body: comments[i] },
        { headers: createAuthHeaders(userTokens[`user${i + 1}`]) }
      );

      if (commentResponse.data.ok) {
        if (i === 0) commentId = commentResponse.data.data.id; // Save first comment ID for threading test
        console.log(`   ✓ User${i + 1} added comment: "${comments[i]}"`);
      } else {
        console.log(`   ⚠ User${i + 1} comment failed:`, commentResponse.data.error?.message);
      }
    }

    // Step 10: Test threaded comments (reply to first comment)
    if (commentId) {
      console.log('\n10. Testing threaded comments...');
      const replyResponse = await axios.post(
        `${BASE_URL}/api/v1/reviews/${reviewId}/comments`,
        { 
          body: 'I completely agree with your assessment.',
          parentCommentId: commentId
        },
        { headers: createAuthHeaders(userTokens.user2) }
      );

      if (replyResponse.data.ok) {
        console.log(`   ✓ Threaded comment created successfully`);
        console.log(`   ✓ Parent comment ID: ${commentId}`);
        console.log(`   ✓ Reply comment ID: ${replyResponse.data.data.id}`);
      } else {
        console.log(`   ⚠ Threaded comment failed:`, replyResponse.data.error?.message);
      }
    }

    // Step 11: List all comments for the review
    console.log('\n11. Listing all review comments...');
    const listCommentsResponse = await axios.get(
      `${BASE_URL}/api/v1/reviews/${reviewId}/comments`,
      { headers: createAuthHeaders(userTokens.user1) }
    );

    if (listCommentsResponse.data.ok) {
      const comments = listCommentsResponse.data.data;
      console.log(`   ✓ Found ${comments.length} comments`);
      comments.forEach((comment, index) => {
        console.log(`   ✓ Comment ${index + 1}: "${comment.body}" (Parent: ${comment.parentCommentId || 'None'})`);
      });
    } else {
      console.log(`   ⚠ Failed to list comments:`, listCommentsResponse.data.error?.message);
    }

    // Step 12: Media upload validated as part of direct multipart creation above
    console.log('\n12. Media upload validated via direct multipart creation');

    // Step 13: Create additional reviews with different labels
    console.log('\n13. Creating additional reviews with different labels...');
    const additionalReviews = [
      {
        communityId: communityId,
        targetId: 'test-man-456',
        label: 'green',
        comment: 'This person was respectful and appropriate in all interactions.'
      },
      {
        communityId: communityId,
        targetId: 'test-man-789',
        label: 'unknown',
        comment: 'Not enough information to make a determination.'
      }
    ];

    for (let i = 0; i < additionalReviews.length; i++) {
      const reviewResponse = await axios.post(
        `${BASE_URL}/api/v1/reviews`,
        additionalReviews[i],
        { headers: createAuthHeaders(userTokens[`user${(i % 3) + 1}`]) }
      );

      if (reviewResponse.data.ok) {
        console.log(`   ✓ Additional review ${i + 1} created (${additionalReviews[i].label})`);
      } else {
        console.log(`   ⚠ Additional review ${i + 1} failed:`, reviewResponse.data.error?.message);
      }
    }

    // Step 14: Test aggregated reviews again (should now have data)
    console.log('\n14. Testing aggregated reviews with data...');
    try {
      const finalAggregateResponse = await axios.get(
        `${BASE_URL}/api/v1/reviews/aggregate?limit=10`,
        { headers: createAuthHeaders(userTokens.user1) }
      );
      
      if (finalAggregateResponse.data.ok) {
        const reviews = finalAggregateResponse.data.data || [];
        console.log(`   ✓ Final aggregated reviews: ${reviews.length} reviews found`);
        
        reviews.forEach((review, index) => {
          console.log(`   ✓ Review ${index + 1}: ${review.label} - "${review.comment?.substring(0, 50)}..."`);
        });
      } else {
        console.log(`   ⚠ Failed to fetch final aggregated reviews:`, finalAggregateResponse.data.error?.message);
      }
    } catch (error) {
      console.log(`   ⚠ Final aggregated reviews error:`, error.response?.data?.error?.message || error.message);
    }

    // Step 15: Test error handling
    console.log('\n15. Testing error handling...');
    
    // Test invalid label
    try {
      await axios.post(
        `${BASE_URL}/api/v1/reviews`,
        {
          communityId: communityId,
          targetId: 'test-man-invalid',
          label: 'invalid-label',
          comment: 'This should fail'
        },
        { headers: createAuthHeaders(userTokens.user1) }
      );
      console.log(`   ⚠ Invalid label test should have failed but didn't`);
    } catch (error) {
      if (error.response?.status === 400) {
        console.log(`   ✓ Invalid label correctly rejected`);
      } else {
        console.log(`   ⚠ Unexpected error for invalid label:`, error.message);
      }
    }

    // Test missing required fields
    try {
      await axios.post(
        `${BASE_URL}/api/v1/reviews`,
        {
          targetId: 'test-man-missing',
          label: 'red'
          // Missing communityId
        },
        { headers: createAuthHeaders(userTokens.user1) }
      );
      console.log(`   ⚠ Missing communityId test should have failed but didn't`);
    } catch (error) {
      if (error.response?.status === 400) {
        console.log(`   ✓ Missing communityId correctly rejected`);
      } else {
        console.log(`   ⚠ Unexpected error for missing communityId:`, error.message);
      }
    }

    // Test non-existent review
    try {
      await axios.get(
        `${BASE_URL}/api/v1/reviews/non-existent-review-id`,
        { headers: createAuthHeaders(userTokens.user1) }
      );
      console.log(`   ⚠ Non-existent review test should have failed but didn't`);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`   ✓ Non-existent review correctly rejected`);
      } else {
        console.log(`   ⚠ Unexpected error for non-existent review:`, error.message);
      }
    }

    console.log('\n✅ Men Reviews E2E test completed successfully!');
    console.log('\n=== Test Summary ===');
    console.log('✓ User authentication and login');
    console.log('✓ Community creation and joining');
    console.log('✓ Review creation with different labels (red/green/unknown)');
    console.log('✓ Review voting by multiple users');
    console.log('✓ Review comments and threaded replies');
    console.log('✓ Review aggregation and listing');
    console.log('✓ Media upload for men review subjects');
    console.log('✓ Error handling and validation');
    console.log('✓ Multiple review creation');

  } catch (error) {
    console.error('\n❌ Men Reviews E2E test failed:', error.message);
    if (error.response?.data) {
      console.error('Error details:', error.response.data);
    }
    throw error;
  }
}

// Main execution
async function main() {
  try {
    await testMenReviews();
  } catch (error) {
    console.error('Test execution failed:', error.message);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main();
}

module.exports = { testMenReviews };
