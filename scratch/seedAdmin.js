import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.DB_CTX;

async function seedAdmin() {
  try {
    await mongoose.connect(MONGODB_URI, { dbName: 'saralbuy' });
    console.log('Connected to MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({
      firstName: String,
      lastName: String,
      email: String,
      phone: String,
      password: String,
      role: String,
      status: { type: String, default: 'active' },
      lastLogin: Date,
    }, { timestamps: true }));

    const existing = await User.findOne({ role: 'admin' });
    if (existing) {
      console.log('Admin already exists:', existing.email);
      await mongoose.connection.close();
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('SaralBuy@2026', salt);

    const admin = await User.create({
      email: 'admin@saralbuy.com',
      firstName: 'Saral',
      lastName: 'Admin',
      role: 'admin',
      phone: '+910000000000',
      password: hashedPassword,
      status: 'active',
    });

    console.log('✅ Admin created successfully!');
    console.log('   Email:    admin@saralbuy.com');
    console.log('   Password: SaralBuy@2026');

    await mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

seedAdmin();
