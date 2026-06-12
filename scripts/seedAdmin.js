import '../src/config/env.js';
import mongoCtx from '../src/config/db.config.js';
import User from '../src/models/user.schema.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const args = process.argv.slice(2);
if (args.length < 4) {
  console.log('❌ Error: Missing arguments.');
  console.log('Usage: node scripts/seedAdmin.js <email> <password> <firstName> <lastName>');
  process.exit(1);
}

const [email, password, firstName, lastName] = args;

const run = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoCtx();

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`❌ Error: User with email "${email}" already exists!`);
      process.exit(1);
    }

    console.log('👤 Creating admin user document...');
    const randomPhone = `+91${Math.floor(6000000000 + Math.random() * 4000000000)}`;
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phone: randomPhone,
      role: 'admin',
      status: 'active',
    });

    console.log('\n🎉 Admin user successfully created!');
    console.log(
      JSON.stringify(
        {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status,
          phone: user.phone,
        },
        null,
        2
      )
    );
  } catch (err) {
    console.error('❌ Failed to seed admin:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

run();
