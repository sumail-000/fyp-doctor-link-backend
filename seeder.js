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

// Pakistani doctor avatar URLs (professional headshots)
const doctorAvatars = [
    'https://randomuser.me/api/portraits/women/44.jpg',   // Ayesha
    'https://randomuser.me/api/portraits/men/32.jpg',      // Ahmed
    'https://randomuser.me/api/portraits/women/68.jpg',    // Sana
    'https://randomuser.me/api/portraits/men/75.jpg',      // Hassan
    'https://randomuser.me/api/portraits/women/65.jpg',    // Fatima
    'https://randomuser.me/api/portraits/men/45.jpg',      // Usman
    'https://randomuser.me/api/portraits/women/50.jpg',    // Maryam
];

const patientAvatars = [
    'https://randomuser.me/api/portraits/men/22.jpg',      // Umair
    'https://randomuser.me/api/portraits/women/26.jpg',    // Sara
    'https://randomuser.me/api/portraits/men/36.jpg',      // Ali
    'https://randomuser.me/api/portraits/women/33.jpg',    // Nadia
    'https://randomuser.me/api/portraits/men/41.jpg',      // Farhan
];

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

        // Also clear Notification and ContactMessage if they exist
        try { await mongoose.connection.db.dropCollection('notifications'); } catch(e) {}
        try { await mongoose.connection.db.dropCollection('contactmessages'); } catch(e) {}

        console.log('Cleared existing data...');

        // ==================== ADMIN ====================
        const admin = await User.create({
            name: 'Admin',
            email: 'admin@doctorlink.pk',
            password: 'admin123',
            role: 'admin',
            avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
        });
        console.log('Admin created: admin@doctorlink.pk / admin123');

        // ==================== PATIENTS ====================
        const patientsRaw = [
            { name: 'Umair Jamil', email: 'umair@mail.com', password: 'patient123', role: 'patient', phone: '+92 300 1234567', city: 'Gujrat' },
            { name: 'Sara Khan', email: 'sara@mail.com', password: 'patient123', role: 'patient', phone: '+92 321 9876543', city: 'Lahore' },
            { name: 'Ali Hassan', email: 'ali@mail.com', password: 'patient123', role: 'patient', phone: '+92 333 5556677', city: 'Islamabad' },
            { name: 'Nadia Akram', email: 'nadia@mail.com', password: 'patient123', role: 'patient', phone: '+92 312 4445566', city: 'Karachi' },
            { name: 'Farhan Malik', email: 'farhan@mail.com', password: 'patient123', role: 'patient', phone: '+92 321 0001122', city: 'Faisalabad' },
        ];
        const patients = [];
        for (let i = 0; i < patientsRaw.length; i++) {
            const p = await User.create({ ...patientsRaw[i], avatar: patientAvatars[i] });
            patients.push(p);
        }
        console.log(`${patients.length} patients created`);

        // ==================== DOCTOR USERS ====================
        const doctorUsersRaw = [
            { name: 'Dr. Ayesha Khan', email: 'ayesha@health.pk', password: 'doctor123', role: 'doctor', phone: '+92 321 1234567' },
            { name: 'Dr. Ahmed Raza', email: 'ahmed@health.pk', password: 'doctor123', role: 'doctor', phone: '+92 300 9876543' },
            { name: 'Dr. Sana Malik', email: 'sana@health.pk', password: 'doctor123', role: 'doctor', phone: '+92 333 2223344' },
            { name: 'Dr. Hassan Javed', email: 'hassan@health.pk', password: 'doctor123', role: 'doctor', phone: '+92 345 1112233' },
            { name: 'Dr. Fatima Noor', email: 'fatima@health.pk', password: 'doctor123', role: 'doctor', phone: '+92 300 7778899' },
            { name: 'Dr. Usman Ali', email: 'usman@health.pk', password: 'doctor123', role: 'doctor', phone: '+92 312 3334455' },
            { name: 'Dr. Maryam Iqbal', email: 'maryam@health.pk', password: 'doctor123', role: 'doctor', phone: '+92 333 6667788' },
        ];
        const doctorUsers = [];
        for (let i = 0; i < doctorUsersRaw.length; i++) {
            const u = await User.create({ ...doctorUsersRaw[i], avatar: doctorAvatars[i] });
            doctorUsers.push(u);
        }
        console.log(`${doctorUsers.length} doctor users created`);

        // ==================== SCHEDULES ====================
        const defaultSchedule = [
            { day: 'Monday', slots: ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'], isActive: true },
            { day: 'Tuesday', slots: ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'], isActive: true },
            { day: 'Wednesday', slots: ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM'], isActive: true },
            { day: 'Thursday', slots: ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'], isActive: true },
            { day: 'Friday', slots: ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM'], isActive: true },
            { day: 'Saturday', slots: ['10:00 AM', '11:00 AM', '12:00 PM'], isActive: true },
            { day: 'Sunday', slots: [], isActive: false },
        ];

        // ==================== DOCTOR PROFILES (stats start at 0, computed later) ====================
        const doctorsData = [
            { user: doctorUsers[0]._id, fullName: 'Dr. Ayesha Khan', email: 'ayesha@health.pk', phone: '+92 321 1234567', cnic: '35202-1234567-1', pmcNumber: 'PMC-12345-LHR', specialization: 'Cardiologist', experience: 12, fee: 3000, location: 'Punjab Institute of Cardiology, Lahore', degree: 'MBBS, FCPS (Cardiology)', about: 'Board-certified cardiologist with over 12 years of experience in diagnosing and treating cardiovascular diseases.', languages: ['English', 'Urdu', 'Punjabi'], avatar: doctorAvatars[0] },
            { user: doctorUsers[1]._id, fullName: 'Dr. Ahmed Raza', email: 'ahmed@health.pk', phone: '+92 300 9876543', cnic: '61101-2345678-2', pmcNumber: 'PMC-23456-ISB', specialization: 'Neurologist', experience: 8, fee: 2500, location: 'Shifa International, Islamabad', degree: 'MBBS, MRCP (Neurology)', about: 'Specializes in epilepsy management and neurodegenerative disorders.', languages: ['English', 'Urdu'], avatar: doctorAvatars[1] },
            { user: doctorUsers[2]._id, fullName: 'Dr. Sana Malik', email: 'sana@health.pk', phone: '+92 333 2223344', cnic: '46301-3456789-3', pmcNumber: 'PMC-34567-RWP', specialization: 'Pediatrician', experience: 6, fee: 2000, location: 'Holy Family Hospital, Rawalpindi', degree: 'MBBS, FCPS (Pediatrics)', about: 'Dedicated pediatrician with expertise in child development and neonatal care.', languages: ['English', 'Urdu'], avatar: doctorAvatars[2] },
            { user: doctorUsers[3]._id, fullName: 'Dr. Hassan Javed', email: 'hassan@health.pk', phone: '+92 345 1112233', cnic: '34101-4567890-4', pmcNumber: 'PMC-45678-GRT', specialization: 'General Physician', experience: 10, fee: 1500, location: 'Aziz Bhatti Shaheed Hospital, Gujrat', degree: 'MBBS', about: 'Experienced general physician providing comprehensive primary healthcare.', languages: ['English', 'Urdu', 'Punjabi'], avatar: doctorAvatars[3] },
            { user: doctorUsers[4]._id, fullName: 'Dr. Fatima Noor', email: 'fatima@health.pk', phone: '+92 300 7778899', cnic: '42101-5678901-5', pmcNumber: 'PMC-56789-KHI', specialization: 'Dermatologist', experience: 15, fee: 3500, location: 'Aga Khan University Hospital, Karachi', degree: 'MBBS, FCPS (Dermatology)', about: 'Leading dermatologist specializing in cosmetic dermatology and skin disorders.', languages: ['English', 'Urdu', 'Sindhi'], avatar: doctorAvatars[4] },
            { user: doctorUsers[5]._id, fullName: 'Dr. Usman Ali', email: 'usman@health.pk', phone: '+92 312 3334455', cnic: '35202-6789012-6', pmcNumber: 'PMC-67890-LHR', specialization: 'Orthopedic Surgeon', experience: 20, fee: 5000, location: 'Doctors Hospital, Lahore', degree: 'MBBS, MS (Orthopedics)', about: 'Senior orthopedic surgeon specializing in joint replacement and sports medicine.', languages: ['English', 'Urdu'], avatar: doctorAvatars[5] },
            { user: doctorUsers[6]._id, fullName: 'Dr. Maryam Iqbal', email: 'maryam@health.pk', phone: '+92 333 6667788', cnic: '38401-7890123-7', pmcNumber: 'PMC-78901-FSD', specialization: 'Gynecologist', experience: 14, fee: 4000, location: 'Allied Hospital, Faisalabad', degree: 'MBBS, FCPS (Gynecology & Obstetrics)', about: 'Expert gynecologist with extensive experience in high-risk pregnancies.', languages: ['English', 'Urdu', 'Punjabi'], avatar: doctorAvatars[6] },
        ];

        const doctors = [];
        for (const d of doctorsData) {
            const doc = await Doctor.create({ ...d, schedule: defaultSchedule, status: 'approved', rating: 0, totalReviews: 0, totalPatients: 0, totalEarnings: 0 });
            doctors.push(doc);
        }
        console.log(`${doctors.length} doctor profiles created`);

        // ==================== PENDING DOCTORS ====================
        const pendingDoctorUser1 = await User.create({ name: 'Dr. Zara Ahmed', email: 'zara@health.pk', password: 'doctor123', role: 'doctor' });
        const pendingDoctorUser2 = await User.create({ name: 'Dr. Bilal Tariq', email: 'bilal@health.pk', password: 'doctor123', role: 'doctor' });

        await Doctor.create([
            { user: pendingDoctorUser1._id, fullName: 'Dr. Zara Ahmed', email: 'zara@health.pk', cnic: '42101-8901234-8', pmcNumber: 'PMC-89012-KHI', specialization: 'Dermatologist', experience: 5, fee: 2500, location: 'Karachi', degree: 'MBBS, FCPS (Dermatology)', about: 'Specialized in cosmetic dermatology.', status: 'pending', schedule: defaultSchedule },
            { user: pendingDoctorUser2._id, fullName: 'Dr. Bilal Tariq', email: 'bilal@health.pk', cnic: '46301-9012345-9', pmcNumber: 'PMC-90123-RWP', specialization: 'Neurologist', experience: 6, fee: 4000, location: 'Rawalpindi', degree: 'MBBS, MRCP (Neurology)', about: 'Specializes in epilepsy management.', status: 'pending', schedule: defaultSchedule },
        ]);
        console.log('2 pending doctor applications created');

        // ==================== APPOINTMENTS (past completed + confirmed + pending + upcoming + cancelled) ====================
        const now = new Date();
        const allAppointments = [];
        const platformFeePercent = 10;

        // Helper: get a past date N days ago
        const pastDate = (daysAgo) => {
            const d = new Date(now);
            d.setDate(d.getDate() - daysAgo);
            d.setHours(9, 0, 0, 0);
            return d;
        };

        // Helper: get a future date N days from now
        const futureDate = (daysAhead) => {
            const d = new Date(now);
            d.setDate(d.getDate() + daysAhead);
            d.setHours(9, 0, 0, 0);
            return d;
        };

        // --- COMPLETED appointments (past, paid) - these are the ones patients can review ---
        const completedAppointmentsData = [
            // Umair's completed appointments (3 different doctors)
            { patient: patients[0]._id, doctor: doctors[0]._id, date: pastDate(30), timeSlot: '9:00 AM', status: 'completed', fee: doctors[0].fee, paymentStatus: 'paid' },
            { patient: patients[0]._id, doctor: doctors[2]._id, date: pastDate(25), timeSlot: '10:00 AM', status: 'completed', fee: doctors[2].fee, paymentStatus: 'paid' },
            { patient: patients[0]._id, doctor: doctors[3]._id, date: pastDate(20), timeSlot: '11:00 AM', status: 'completed', fee: doctors[3].fee, paymentStatus: 'paid' },
            // Sara's completed
            { patient: patients[1]._id, doctor: doctors[0]._id, date: pastDate(28), timeSlot: '10:00 AM', status: 'completed', fee: doctors[0].fee, paymentStatus: 'paid' },
            { patient: patients[1]._id, doctor: doctors[1]._id, date: pastDate(22), timeSlot: '1:00 PM', status: 'completed', fee: doctors[1].fee, paymentStatus: 'paid' },
            { patient: patients[1]._id, doctor: doctors[4]._id, date: pastDate(15), timeSlot: '2:00 PM', status: 'completed', fee: doctors[4].fee, paymentStatus: 'paid' },
            // Ali's completed
            { patient: patients[2]._id, doctor: doctors[1]._id, date: pastDate(26), timeSlot: '9:00 AM', status: 'completed', fee: doctors[1].fee, paymentStatus: 'paid' },
            { patient: patients[2]._id, doctor: doctors[3]._id, date: pastDate(18), timeSlot: '3:00 PM', status: 'completed', fee: doctors[3].fee, paymentStatus: 'paid' },
            { patient: patients[2]._id, doctor: doctors[5]._id, date: pastDate(12), timeSlot: '10:00 AM', status: 'completed', fee: doctors[5].fee, paymentStatus: 'paid' },
            // Nadia's completed
            { patient: patients[3]._id, doctor: doctors[4]._id, date: pastDate(24), timeSlot: '11:00 AM', status: 'completed', fee: doctors[4].fee, paymentStatus: 'paid' },
            { patient: patients[3]._id, doctor: doctors[6]._id, date: pastDate(16), timeSlot: '1:00 PM', status: 'completed', fee: doctors[6].fee, paymentStatus: 'paid' },
            { patient: patients[3]._id, doctor: doctors[0]._id, date: pastDate(10), timeSlot: '2:00 PM', status: 'completed', fee: doctors[0].fee, paymentStatus: 'paid' },
            // Farhan's completed
            { patient: patients[4]._id, doctor: doctors[5]._id, date: pastDate(21), timeSlot: '9:00 AM', status: 'completed', fee: doctors[5].fee, paymentStatus: 'paid' },
            { patient: patients[4]._id, doctor: doctors[6]._id, date: pastDate(14), timeSlot: '10:00 AM', status: 'completed', fee: doctors[6].fee, paymentStatus: 'paid' },
            { patient: patients[4]._id, doctor: doctors[2]._id, date: pastDate(8), timeSlot: '11:00 AM', status: 'completed', fee: doctors[2].fee, paymentStatus: 'paid' },
            // Extra completed for more reviews per doctor
            { patient: patients[0]._id, doctor: doctors[4]._id, date: pastDate(7), timeSlot: '3:00 PM', status: 'completed', fee: doctors[4].fee, paymentStatus: 'paid' },
            { patient: patients[1]._id, doctor: doctors[5]._id, date: pastDate(6), timeSlot: '2:00 PM', status: 'completed', fee: doctors[5].fee, paymentStatus: 'paid' },
            { patient: patients[2]._id, doctor: doctors[6]._id, date: pastDate(5), timeSlot: '9:00 AM', status: 'completed', fee: doctors[6].fee, paymentStatus: 'paid' },
            { patient: patients[3]._id, doctor: doctors[1]._id, date: pastDate(4), timeSlot: '10:00 AM', status: 'completed', fee: doctors[1].fee, paymentStatus: 'paid' },
            { patient: patients[4]._id, doctor: doctors[0]._id, date: pastDate(3), timeSlot: '11:00 AM', status: 'completed', fee: doctors[0].fee, paymentStatus: 'paid' },
            { patient: patients[0]._id, doctor: doctors[6]._id, date: pastDate(2), timeSlot: '1:00 PM', status: 'completed', fee: doctors[6].fee, paymentStatus: 'paid' },
            { patient: patients[1]._id, doctor: doctors[2]._id, date: pastDate(2), timeSlot: '2:00 PM', status: 'completed', fee: doctors[2].fee, paymentStatus: 'paid' },
        ];

        // --- CONFIRMED appointments (upcoming, paid) ---
        const confirmedAppointmentsData = [
            { patient: patients[0]._id, doctor: doctors[0]._id, date: futureDate(2), timeSlot: '10:00 AM', status: 'confirmed', fee: doctors[0].fee, paymentStatus: 'paid' },
            { patient: patients[1]._id, doctor: doctors[2]._id, date: futureDate(3), timeSlot: '11:00 AM', status: 'confirmed', fee: doctors[2].fee, paymentStatus: 'paid' },
            { patient: patients[2]._id, doctor: doctors[4]._id, date: futureDate(4), timeSlot: '9:00 AM', status: 'confirmed', fee: doctors[4].fee, paymentStatus: 'paid' },
            { patient: patients[0]._id, doctor: doctors[5]._id, date: futureDate(5), timeSlot: '1:00 PM', status: 'confirmed', fee: doctors[5].fee, paymentStatus: 'paid' },
        ];

        // --- PENDING appointments (upcoming, paid but awaiting doctor confirmation) ---
        const pendingAppointmentsData = [
            { patient: patients[3]._id, doctor: doctors[1]._id, date: futureDate(1), timeSlot: '9:00 AM', status: 'pending', fee: doctors[1].fee, paymentStatus: 'paid' },
            { patient: patients[4]._id, doctor: doctors[3]._id, date: futureDate(2), timeSlot: '2:00 PM', status: 'pending', fee: doctors[3].fee, paymentStatus: 'paid' },
            { patient: patients[0]._id, doctor: doctors[6]._id, date: futureDate(3), timeSlot: '10:00 AM', status: 'pending', fee: doctors[6].fee, paymentStatus: 'paid' },
        ];

        // --- CANCELLED appointments ---
        const cancelledAppointmentsData = [
            { patient: patients[2]._id, doctor: doctors[0]._id, date: pastDate(9), timeSlot: '3:00 PM', status: 'cancelled', fee: doctors[0].fee, paymentStatus: 'refunded', cancelledBy: 'patient', cancelReason: 'Schedule conflict' },
            { patient: patients[4]._id, doctor: doctors[1]._id, date: pastDate(11), timeSlot: '1:00 PM', status: 'cancelled', fee: doctors[1].fee, paymentStatus: 'refunded', cancelledBy: 'doctor', cancelReason: 'Doctor unavailable' },
        ];

        // Create all appointments
        const allAptData = [...completedAppointmentsData, ...confirmedAppointmentsData, ...pendingAppointmentsData, ...cancelledAppointmentsData];
        for (const aptData of allAptData) {
            aptData.paymentId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const apt = await Appointment.create(aptData);
            allAppointments.push(apt);
        }
        console.log(`${allAppointments.length} appointments created`);

        // ==================== PAYMENTS (for all paid/refunded appointments) ====================
        const allPayments = [];
        for (const apt of allAppointments) {
            if (apt.paymentStatus === 'paid' || apt.paymentStatus === 'refunded') {
                const amount = apt.fee;
                const platformFee = Math.round(amount * (platformFeePercent / 100));
                const doctorEarning = amount - platformFee;
                const payment = await Payment.create({
                    appointment: apt._id,
                    patient: apt.patient,
                    doctor: apt.doctor,
                    amount,
                    platformFee,
                    doctorEarning,
                    status: apt.paymentStatus === 'refunded' ? 'refunded' : 'completed',
                    stripePaymentIntentId: apt.paymentId,
                    refundedAt: apt.paymentStatus === 'refunded' ? new Date() : undefined,
                });
                allPayments.push(payment);
            }
        }
        console.log(`${allPayments.length} payments created`);

        // ==================== REVIEWS (one per completed appointment, max 5 per doctor) ====================
        const completedApts = allAppointments.filter(a => a.status === 'completed');
        const reviewComments = [
            'Excellent doctor, very thorough examination. Explained everything in detail.',
            'Very professional and caring. Highly recommended to everyone!',
            'Great experience, the doctor was very patient and listened carefully.',
            'Good consultation, explained everything clearly. Will visit again.',
            'Best doctor I have visited. Truly exceptional care and attention.',
            'Very knowledgeable and experienced. Made me feel comfortable.',
            'Wonderful bedside manner. Took time to answer all my questions.',
            'Highly skilled professional. The diagnosis was spot on.',
            'Amazing doctor! Very friendly and thorough in the examination.',
            'Excellent care and follow-up. Would definitely recommend.',
        ];

        const doctorReviewCount = {};
        let reviewsCreated = 0;
        for (const apt of completedApts) {
            const docId = apt.doctor.toString();
            if (!doctorReviewCount[docId]) doctorReviewCount[docId] = 0;
            if (doctorReviewCount[docId] >= 5) continue; // Max 5 reviews per doctor

            const rating = [4, 5, 5, 4, 5, 4, 5, 5, 4, 5][reviewsCreated % 10];
            const comment = reviewComments[reviewsCreated % reviewComments.length];

            // Create review one-by-one to trigger calcAverageRating hook
            await Review.create({
                patient: apt.patient,
                doctor: apt.doctor,
                appointment: apt._id,
                rating,
                comment,
            });
            doctorReviewCount[docId]++;
            reviewsCreated++;
        }
        console.log(`${reviewsCreated} reviews created (triggers rating recalculation)`);

        // Wait a moment for async hooks to complete
        await new Promise(r => setTimeout(r, 1000));

        // ==================== UPDATE DOCTOR STATS from actual data ====================
        for (const doc of doctors) {
            // Count unique patients from completed appointments
            const uniquePatients = await Appointment.distinct('patient', {
                doctor: doc._id,
                status: 'completed',
            });

            // Sum doctor earnings from completed payments
            const earningsResult = await Payment.aggregate([
                { $match: { doctor: doc._id, status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$doctorEarning' } } },
            ]);
            const totalEarnings = earningsResult[0]?.total || 0;

            await Doctor.findByIdAndUpdate(doc._id, {
                totalPatients: uniquePatients.length,
                totalEarnings,
            });
        }
        console.log('Doctor stats (totalPatients, totalEarnings) updated from actual data');

        // Verify ratings were set
        const updatedDoctors = await Doctor.find({ status: 'approved' }).select('fullName rating totalReviews totalPatients totalEarnings');
        updatedDoctors.forEach(d => {
            console.log(`  ${d.fullName}: rating=${d.rating}, reviews=${d.totalReviews}, patients=${d.totalPatients}, earnings=Rs.${d.totalEarnings}`);
        });

        // ==================== SETTINGS ====================
        await Setting.create({});
        console.log('Default settings created');

        console.log('\n✅ Database seeded successfully!');
        console.log('\n📋 Login Credentials:');
        console.log('   Admin:   admin@doctorlink.pk / admin123');
        console.log('   Patient: umair@mail.com / patient123');
        console.log('   Doctor:  ayesha@health.pk / doctor123');
        console.log('\n📊 Data Summary:');
        console.log(`   ${patients.length} patients, ${doctors.length} approved doctors, 2 pending doctors`);
        console.log(`   ${allAppointments.length} appointments (${completedApts.length} completed, ${confirmedAppointmentsData.length} confirmed, ${pendingAppointmentsData.length} pending, ${cancelledAppointmentsData.length} cancelled)`);
        console.log(`   ${allPayments.length} payments, ${reviewsCreated} reviews`);

        process.exit(0);
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
};

seed();
