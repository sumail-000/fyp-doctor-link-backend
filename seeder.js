const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');
const Doctor = require('./models/Doctor');
const Appointment = require('./models/Appointment');
const Payment = require('./models/Payment');
const Review = require('./models/Review');
const Setting = require('./models/Setting');

dotenv.config();

const connectDB = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for seeding...');
};

const seed = async () => {
    try {
        await connectDB();

        // Clear existing data
        await User.deleteMany();
        await Doctor.deleteMany();
        await Appointment.deleteMany();
        await Payment.deleteMany();
        await Review.deleteMany();
        await Setting.deleteMany();

        console.log('Cleared existing data...');

        // Create admin
        const admin = await User.create({
            name: 'Admin',
            email: 'admin@doctorlink.pk',
            password: 'admin123',
            role: 'admin',
        });
        console.log('Admin created: admin@doctorlink.pk / admin123');

        // Create patients
        const patients = await User.create([
            { name: 'Umair Jamil', email: 'umair@mail.com', password: 'patient123', role: 'patient', phone: '+92 300 1234567', city: 'Gujrat' },
            { name: 'Sara Khan', email: 'sara@mail.com', password: 'patient123', role: 'patient', phone: '+92 321 9876543', city: 'Lahore' },
            { name: 'Ali Hassan', email: 'ali@mail.com', password: 'patient123', role: 'patient', phone: '+92 333 5556677', city: 'Islamabad' },
            { name: 'Nadia Akram', email: 'nadia@mail.com', password: 'patient123', role: 'patient', phone: '+92 312 4445566', city: 'Karachi' },
            { name: 'Farhan Malik', email: 'farhan@mail.com', password: 'patient123', role: 'patient', phone: '+92 321 0001122', city: 'Faisalabad' },
        ]);
        console.log(`${patients.length} patients created`);

        // Create doctor users
        const doctorUsers = await User.create([
            { name: 'Dr. Ayesha Khan', email: 'ayesha@health.pk', password: 'doctor123', role: 'doctor', phone: '+92 321 1234567' },
            { name: 'Dr. Ahmed Raza', email: 'ahmed@health.pk', password: 'doctor123', role: 'doctor', phone: '+92 300 9876543' },
            { name: 'Dr. Sana Malik', email: 'sana@health.pk', password: 'doctor123', role: 'doctor', phone: '+92 333 2223344' },
            { name: 'Dr. Hassan Javed', email: 'hassan@health.pk', password: 'doctor123', role: 'doctor', phone: '+92 345 1112233' },
            { name: 'Dr. Fatima Noor', email: 'fatima@health.pk', password: 'doctor123', role: 'doctor', phone: '+92 300 7778899' },
            { name: 'Dr. Usman Ali', email: 'usman@health.pk', password: 'doctor123', role: 'doctor', phone: '+92 312 3334455' },
            { name: 'Dr. Maryam Iqbal', email: 'maryam@health.pk', password: 'doctor123', role: 'doctor', phone: '+92 333 6667788' },
        ]);
        console.log(`${doctorUsers.length} doctor users created`);

        // Default schedule
        const defaultSchedule = [
            { day: 'Monday', slots: ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'], isActive: true },
            { day: 'Tuesday', slots: ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'], isActive: true },
            { day: 'Wednesday', slots: ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM'], isActive: true },
            { day: 'Thursday', slots: ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'], isActive: true },
            { day: 'Friday', slots: ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM'], isActive: true },
            { day: 'Saturday', slots: ['10:00 AM', '11:00 AM', '12:00 PM'], isActive: true },
            { day: 'Sunday', slots: [], isActive: false },
        ];

        // Create doctor profiles
        const doctorsData = [
            { user: doctorUsers[0]._id, fullName: 'Dr. Ayesha Khan', email: 'ayesha@health.pk', phone: '+92 321 1234567', cnic: '35202-1234567-1', pmcNumber: 'PMC-12345-LHR', specialization: 'Cardiologist', experience: 12, fee: 3000, location: 'Punjab Institute of Cardiology, Lahore', degree: 'MBBS, FCPS (Cardiology)', about: 'Board-certified cardiologist with over 12 years of experience in diagnosing and treating cardiovascular diseases.', languages: ['English', 'Urdu', 'Punjabi'], status: 'approved', rating: 4.9, totalReviews: 142, totalPatients: 2400, totalEarnings: 537000 },
            { user: doctorUsers[1]._id, fullName: 'Dr. Ahmed Raza', email: 'ahmed@health.pk', phone: '+92 300 9876543', cnic: '61101-2345678-2', pmcNumber: 'PMC-23456-ISB', specialization: 'Neurologist', experience: 8, fee: 2500, location: 'Shifa International, Islamabad', degree: 'MBBS, MRCP (Neurology)', about: 'Specializes in epilepsy management and neurodegenerative disorders.', languages: ['English', 'Urdu'], status: 'approved', rating: 4.8, totalReviews: 98, totalPatients: 1800, totalEarnings: 420000 },
            { user: doctorUsers[2]._id, fullName: 'Dr. Sana Malik', email: 'sana@health.pk', phone: '+92 333 2223344', cnic: '46301-3456789-3', pmcNumber: 'PMC-34567-RWP', specialization: 'Pediatrician', experience: 6, fee: 2000, location: 'Holy Family Hospital, Rawalpindi', degree: 'MBBS, FCPS (Pediatrics)', about: 'Dedicated pediatrician with expertise in child development and neonatal care.', languages: ['English', 'Urdu'], status: 'approved', rating: 4.7, totalReviews: 89, totalPatients: 1500, totalEarnings: 310000 },
            { user: doctorUsers[3]._id, fullName: 'Dr. Hassan Javed', email: 'hassan@health.pk', phone: '+92 345 1112233', cnic: '34101-4567890-4', pmcNumber: 'PMC-45678-GRT', specialization: 'General Physician', experience: 10, fee: 1500, location: 'Aziz Bhatti Shaheed Hospital, Gujrat', degree: 'MBBS', about: 'Experienced general physician providing comprehensive primary healthcare.', languages: ['English', 'Urdu', 'Punjabi'], status: 'approved', rating: 4.6, totalReviews: 312, totalPatients: 1200, totalEarnings: 280000 },
            { user: doctorUsers[4]._id, fullName: 'Dr. Fatima Noor', email: 'fatima@health.pk', phone: '+92 300 7778899', cnic: '42101-5678901-5', pmcNumber: 'PMC-56789-KHI', specialization: 'Dermatologist', experience: 15, fee: 3500, location: 'Aga Khan University Hospital, Karachi', degree: 'MBBS, FCPS (Dermatology)', about: 'Leading dermatologist specializing in cosmetic dermatology and skin disorders.', languages: ['English', 'Urdu', 'Sindhi'], status: 'approved', rating: 4.9, totalReviews: 210, totalPatients: 980, totalEarnings: 245000 },
            { user: doctorUsers[5]._id, fullName: 'Dr. Usman Ali', email: 'usman@health.pk', phone: '+92 312 3334455', cnic: '35202-6789012-6', pmcNumber: 'PMC-67890-LHR', specialization: 'Orthopedic Surgeon', experience: 20, fee: 5000, location: 'Doctors Hospital, Lahore', degree: 'MBBS, MS (Orthopedics)', about: 'Senior orthopedic surgeon specializing in joint replacement and sports medicine.', languages: ['English', 'Urdu'], status: 'approved', rating: 4.7, totalReviews: 176, totalPatients: 850, totalEarnings: 680000 },
            { user: doctorUsers[6]._id, fullName: 'Dr. Maryam Iqbal', email: 'maryam@health.pk', phone: '+92 333 6667788', cnic: '38401-7890123-7', pmcNumber: 'PMC-78901-FSD', specialization: 'Gynecologist', experience: 14, fee: 4000, location: 'Allied Hospital, Faisalabad', degree: 'MBBS, FCPS (Gynecology & Obstetrics)', about: 'Expert gynecologist with extensive experience in high-risk pregnancies.', languages: ['English', 'Urdu', 'Punjabi'], status: 'approved', rating: 4.9, totalReviews: 267, totalPatients: 1100, totalEarnings: 520000 },
        ];

        const doctors = [];
        for (const d of doctorsData) {
            const doc = await Doctor.create({ ...d, schedule: defaultSchedule });
            doctors.push(doc);
        }
        console.log(`${doctors.length} doctor profiles created`);

        // Create some pending doctor applications
        const pendingDoctorUser1 = await User.create({ name: 'Dr. Zara Ahmed', email: 'zara@health.pk', password: 'doctor123', role: 'doctor' });
        const pendingDoctorUser2 = await User.create({ name: 'Dr. Bilal Tariq', email: 'bilal@health.pk', password: 'doctor123', role: 'doctor' });

        await Doctor.create([
            { user: pendingDoctorUser1._id, fullName: 'Dr. Zara Ahmed', email: 'zara@health.pk', cnic: '42101-8901234-8', pmcNumber: 'PMC-89012-KHI', specialization: 'Dermatologist', experience: 5, fee: 2500, location: 'Karachi', degree: 'MBBS, FCPS (Dermatology)', about: 'Specialized in cosmetic dermatology.', status: 'pending', schedule: defaultSchedule },
            { user: pendingDoctorUser2._id, fullName: 'Dr. Bilal Tariq', email: 'bilal@health.pk', cnic: '46301-9012345-9', pmcNumber: 'PMC-90123-RWP', specialization: 'Neurologist', experience: 6, fee: 4000, location: 'Rawalpindi', degree: 'MBBS, MRCP (Neurology)', about: 'Specializes in epilepsy management.', status: 'pending', schedule: defaultSchedule },
        ]);
        console.log('2 pending doctor applications created');

        // Create appointments
        const now = new Date();
        const appointmentsData = [];
        const statuses = ['completed', 'completed', 'confirmed', 'pending', 'cancelled'];

        for (let i = 0; i < 15; i++) {
            const patientIdx = i % patients.length;
            const doctorIdx = i % doctors.length;
            const statusIdx = i % statuses.length;
            const daysAgo = Math.floor(i / 2);
            const date = new Date(now);
            date.setDate(date.getDate() - daysAgo);

            appointmentsData.push({
                patient: patients[patientIdx]._id,
                doctor: doctors[doctorIdx]._id,
                date,
                timeSlot: ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM'][i % 5],
                status: statuses[statusIdx],
                fee: doctors[doctorIdx].fee,
                paymentStatus: statuses[statusIdx] === 'cancelled' ? 'refunded' : 'paid',
                paymentId: `sim_${Date.now()}_${i}`,
            });
        }

        const appointments = await Appointment.create(appointmentsData);
        console.log(`${appointments.length} appointments created`);

        // Create payments for paid appointments
        const paymentsData = appointments
            .filter(a => a.paymentStatus === 'paid' || a.paymentStatus === 'refunded')
            .map(a => ({
                appointment: a._id,
                patient: a.patient,
                doctor: a.doctor,
                amount: a.fee,
                platformFee: Math.round(a.fee * 0.1),
                doctorEarning: Math.round(a.fee * 0.9),
                status: a.paymentStatus === 'refunded' ? 'refunded' : 'completed',
                stripePaymentIntentId: a.paymentId,
                refundedAt: a.paymentStatus === 'refunded' ? new Date() : undefined,
            }));

        const payments = await Payment.create(paymentsData);
        console.log(`${payments.length} payments created`);

        // Create reviews for completed appointments
        const completedApts = appointments.filter(a => a.status === 'completed');
        const reviewsData = completedApts.map((a, i) => ({
            patient: a.patient,
            doctor: a.doctor,
            appointment: a._id,
            rating: [4, 5, 5, 4, 5][i % 5],
            comment: [
                'Excellent doctor, very thorough examination.',
                'Very professional and caring. Highly recommended!',
                'Great experience, the doctor was very patient.',
                'Good consultation, explained everything clearly.',
                'Best doctor I have visited. Will come again.',
            ][i % 5],
        }));

        const reviews = await Review.create(reviewsData);
        console.log(`${reviews.length} reviews created`);

        // Create default settings
        await Setting.create({});
        console.log('Default settings created');

        console.log('\n✅ Database seeded successfully!');
        console.log('\n📋 Login Credentials:');
        console.log('   Admin:   admin@doctorlink.pk / admin123');
        console.log('   Patient: umair@mail.com / patient123');
        console.log('   Doctor:  ayesha@health.pk / doctor123');

        process.exit(0);
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
};

seed();
