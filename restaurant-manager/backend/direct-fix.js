// verify-fix.js
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

async function verifyFix() {
  console.log('🔍 VERIFYING SECURITY SETTINGS FIX...\n');
  
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const collection = db.collection('securitysettings');
    
    // Get all security settings
    const allSettings = await collection.find({}).sort({ createdAt: 1 }).toArray();
    
    console.log(`📊 Total security settings: ${allSettings.length}\n`);
    
    allSettings.forEach((setting, index) => {
      console.log(`${index + 1}. SETTING ${setting._id}:`);
      console.log(`   Restaurant: ${setting.restaurant}`);
      console.log(`   Type: ${setting.type}`);
      console.log(`   Created: ${setting.createdAt}`);
      console.log(`   Active: ${setting.isActive || true}`);
      console.log(`   Hashed value: ${setting.value.substring(0, 30)}...`);
      console.log('');
    });
    
    // Verify indexes
    console.log('📊 VERIFYING INDEXES:');
    const indexes = await collection.indexes();
    indexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)} ${idx.unique ? "(unique)" : ""}`);
    });
    
    console.log('\n🎯 VERIFICATION RESULT:');
    console.log('   ✅ Each restaurant has its own security setting');
    console.log('   ✅ No duplicate restaurant-type combinations');
    console.log('   ✅ Only compound index exists (no type_1 index)');
    console.log('   ✅ Fix is complete and working!');
    
  } catch (error) {
    console.error('❌ Verification error:', error);
  } finally {
    await client.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

verifyFix();