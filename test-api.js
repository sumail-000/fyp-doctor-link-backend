/**
 * DoctorLink API End-to-End Test Script
 * Tests all routes: Auth, Doctor, Appointment, Payment, Review, Admin
 * Run: node test-api.js
 */

const http = require('http');

const BASE = 'http://localhost:5000/api';

let patientToken = '';
let doctorToken = '';
let adminToken = '';
let patientId = '';
let doctorProfileId = '';
let doctorUserId = '';
let appointmentId = '';
let testUserId = '';

const results = { passed: 0, failed: 0, errors: [] };

function request(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE + path);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function test(name, fn) {
    try {
        await fn();
        results.passed++;
        console.log(`  ✅ ${name}`);
    } catch (err) {
        results.failed++;
        results.errors.push({ name, error: err.message });
        console.log(`  ❌ ${name} — ${err.message}`);
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
}

async function run() {
    console.log('\n🏥 DoctorLink API E2E Tests\n');
    console.log('═'.repeat(60));

    // ==================== HEALTH CHECK ====================
    console.log('\n📡 Health Check');
    await test('GET /api/health', async () => {
        const r = await request('GET', '/health');
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.status === 'ok', 'Health check failed');
    });

    // ==================== AUTH ====================
    console.log('\n🔐 Auth Routes');

    const testEmail = `test_${Date.now()}@test.com`;
    const testPass = 'Test1234!';

    await test('POST /auth/register — register patient', async () => {
        const r = await request('POST', '/auth/register', {
            name: 'Test Patient',
            email: testEmail,
            password: testPass,
        });
        assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.data)}`);
        assert(r.data.token, 'No token returned');
        assert(r.data.user.role === 'patient', 'Role should be patient');
        patientToken = r.data.token;
        patientId = r.data.user._id;
    });

    await test('POST /auth/register — duplicate email fails', async () => {
        const r = await request('POST', '/auth/register', {
            name: 'Dup',
            email: testEmail,
            password: testPass,
        });
        assert(r.status === 400, `Expected 400, got ${r.status}`);
    });

    await test('POST /auth/login — login patient', async () => {
        const r = await request('POST', '/auth/login', { email: testEmail, password: testPass });
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.token, 'No token');
        assert(r.data.user.role === 'patient', 'Wrong role');
        patientToken = r.data.token;
    });

    await test('POST /auth/login — wrong password fails', async () => {
        const r = await request('POST', '/auth/login', { email: testEmail, password: 'wrong' });
        assert(r.status === 401, `Expected 401, got ${r.status}`);
    });

    await test('GET /auth/me — get current user', async () => {
        const r = await request('GET', '/auth/me', null, patientToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.user.email === testEmail, 'Wrong email');
    });

    await test('GET /auth/me — no token fails', async () => {
        const r = await request('GET', '/auth/me');
        assert(r.status === 401, `Expected 401, got ${r.status}`);
    });

    await test('PUT /auth/profile — update profile', async () => {
        const r = await request('PUT', '/auth/profile', {
            name: 'Updated Patient',
            phone: '03001234567',
            city: 'Lahore',
        }, patientToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.user.name === 'Updated Patient', 'Name not updated');
    });

    await test('PUT /auth/password — change password', async () => {
        const r = await request('PUT', '/auth/password', {
            currentPassword: testPass,
            newPassword: 'NewPass1234!',
        }, patientToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
    });

    await test('PUT /auth/password — wrong current password fails', async () => {
        const r = await request('PUT', '/auth/password', {
            currentPassword: 'wrongold',
            newPassword: 'whatever',
        }, patientToken);
        assert(r.status === 400, `Expected 400, got ${r.status}`);
    });

    // Re-login with new password
    await test('POST /auth/login — login with new password', async () => {
        const r = await request('POST', '/auth/login', { email: testEmail, password: 'NewPass1234!' });
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        patientToken = r.data.token;
    });

    // ==================== DOCTOR APPLY ====================
    console.log('\n🩺 Doctor Routes (Public + Apply)');

    const docEmail = `doc_${Date.now()}@test.com`;

    await test('POST /doctors/apply — apply as doctor', async () => {
        const r = await request('POST', '/doctors/apply', {
            fullName: 'Dr. Test Doctor',
            email: docEmail,
            password: 'DocPass123!',
            cnic: '35201-' + Date.now(),
            pmcNumber: 'PMC-' + Date.now(),
            specialization: 'General Physician',
            experience: 5,
            fee: 2000,
            location: 'Lahore',
            degree: 'MBBS',
            about: 'Test doctor for API testing',
            phone: '03009876543',
        });
        assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.data)}`);
        assert(r.data.doctor.status === 'pending', 'Status should be pending');
        doctorProfileId = r.data.doctor._id;
    });

    await test('POST /doctors/login — pending doctor login fails', async () => {
        const r = await request('POST', '/doctors/login', { email: docEmail, password: 'DocPass123!' });
        assert(r.status === 403, `Expected 403, got ${r.status}`);
    });

    await test('GET /doctors — list approved doctors', async () => {
        const r = await request('GET', '/doctors');
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(Array.isArray(r.data.doctors), 'doctors should be array');
        assert(typeof r.data.total === 'number', 'total should be number');
    });

    await test('GET /doctors?search=cardio — search doctors', async () => {
        const r = await request('GET', '/doctors?search=cardio');
        assert(r.status === 200, `Expected 200, got ${r.status}`);
    });

    // ==================== ADMIN ====================
    console.log('\n🛡️  Admin Routes');

    // Login as admin (seeded admin account)
    await test('POST /auth/login — login as admin', async () => {
        const r = await request('POST', '/auth/login', { email: 'admin@doctorlink.pk', password: 'admin123' });
        assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.data)}`);
        assert(r.data.user.role === 'admin', 'Should be admin role');
        adminToken = r.data.token;
    });

    await test('GET /admin/dashboard — dashboard stats', async () => {
        const r = await request('GET', '/admin/dashboard', null, adminToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.stats, 'Missing stats');
        assert(typeof r.data.stats.totalUsers === 'number', 'totalUsers should be number');
        assert(typeof r.data.stats.totalDoctors === 'number', 'totalDoctors should be number');
        assert(Array.isArray(r.data.recentPendingDoctors), 'recentPendingDoctors should be array');
        assert(Array.isArray(r.data.recentAppointments), 'recentAppointments should be array');
        assert(Array.isArray(r.data.recentUsers), 'recentUsers should be array');
    });

    await test('GET /admin/dashboard — no token fails', async () => {
        const r = await request('GET', '/admin/dashboard');
        assert(r.status === 401, `Expected 401, got ${r.status}`);
    });

    await test('GET /admin/dashboard — patient token fails', async () => {
        const r = await request('GET', '/admin/dashboard', null, patientToken);
        assert(r.status === 403, `Expected 403, got ${r.status}`);
    });

    // Doctor Approvals
    await test('GET /admin/doctors/pending — pending doctors', async () => {
        const r = await request('GET', '/admin/doctors/pending', null, adminToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(Array.isArray(r.data.doctors), 'doctors should be array');
    });

    await test('PUT /admin/doctors/:id/approve — approve doctor', async () => {
        const r = await request('PUT', `/admin/doctors/${doctorProfileId}/approve`, null, adminToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.doctor.status === 'approved', 'Status should be approved');
    });

    // Now doctor can login
    await test('POST /doctors/login — approved doctor login', async () => {
        const r = await request('POST', '/doctors/login', { email: docEmail, password: 'DocPass123!' });
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.token, 'No token');
        doctorToken = r.data.token;
        doctorUserId = r.data.user._id;
    });

    // Get single doctor (public)
    await test('GET /doctors/:id — get single doctor', async () => {
        const r = await request('GET', `/doctors/${doctorProfileId}`);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.doctor.fullName === 'Dr. Test Doctor', 'Wrong name');
    });

    await test('GET /doctors/:id/slots — get doctor slots', async () => {
        const r = await request('GET', `/doctors/${doctorProfileId}/slots`);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(typeof r.data.fee === 'number', 'fee should be number');
    });

    // ==================== DOCTOR AUTHENTICATED ====================
    console.log('\n👨‍⚕️ Doctor Authenticated Routes');

    await test('GET /doctors/me/profile — get my profile', async () => {
        const r = await request('GET', '/doctors/me/profile', null, doctorToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.doctor.fullName === 'Dr. Test Doctor', 'Wrong name');
    });

    await test('PUT /doctors/me/profile — update profile', async () => {
        const r = await request('PUT', '/doctors/me/profile', {
            about: 'Updated bio for testing',
            fee: 2500,
        }, doctorToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.doctor.fee === 2500, 'Fee not updated');
    });

    await test('PUT /doctors/me/schedule — update schedule', async () => {
        const r = await request('PUT', '/doctors/me/schedule', {
            schedule: [
                { day: 'Monday', isActive: true, slots: ['09:00 - 09:30', '10:00 - 10:30'] },
                { day: 'Tuesday', isActive: true, slots: ['14:00 - 14:30'] },
                { day: 'Wednesday', isActive: false, slots: [] },
            ],
        }, doctorToken);
        assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.data)}`);
        assert(Array.isArray(r.data.schedule), 'schedule should be array');
    });

    await test('GET /doctors/me/dashboard — doctor dashboard', async () => {
        const r = await request('GET', '/doctors/me/dashboard', null, doctorToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.stats, 'Missing stats');
        assert(typeof r.data.stats.totalAppointments === 'number', 'totalAppointments should be number');
    });

    await test('GET /doctors/me/patients — doctor patients', async () => {
        const r = await request('GET', '/doctors/me/patients', null, doctorToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(Array.isArray(r.data.patients), 'patients should be array');
    });

    await test('GET /doctors/me/earnings — doctor earnings', async () => {
        const r = await request('GET', '/doctors/me/earnings', null, doctorToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(typeof r.data.totalEarnings === 'number', 'totalEarnings should be number');
        assert(Array.isArray(r.data.recentPayments), 'recentPayments should be array');
    });

    // ==================== APPOINTMENTS ====================
    console.log('\n📅 Appointment Routes');

    // Get next Monday for a valid date
    const nextMonday = new Date();
    nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
    const dateStr = nextMonday.toISOString().split('T')[0];

    await test('POST /appointments — create appointment', async () => {
        const r = await request('POST', '/appointments', {
            doctorId: doctorProfileId,
            date: dateStr,
            timeSlot: '09:00 - 09:30',
        }, patientToken);
        assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.data)}`);
        assert(r.data.appointment, 'Missing appointment');
        appointmentId = r.data.appointment._id;
    });

    await test('POST /appointments — duplicate slot fails', async () => {
        const r = await request('POST', '/appointments', {
            doctorId: doctorProfileId,
            date: dateStr,
            timeSlot: '09:00 - 09:30',
        }, patientToken);
        assert(r.status === 400, `Expected 400, got ${r.status}`);
    });

    await test('GET /appointments/my — patient appointments', async () => {
        const r = await request('GET', '/appointments/my', null, patientToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(Array.isArray(r.data.appointments), 'appointments should be array');
        assert(r.data.appointments.length > 0, 'Should have at least 1 appointment');
    });

    await test('GET /appointments/dashboard — patient dashboard', async () => {
        const r = await request('GET', '/appointments/dashboard', null, patientToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.stats, 'Missing stats');
    });

    await test('GET /appointments/doctor — doctor appointments', async () => {
        const r = await request('GET', '/appointments/doctor', null, doctorToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(Array.isArray(r.data.appointments), 'appointments should be array');
    });

    await test('PUT /appointments/:id/accept — accept appointment', async () => {
        const r = await request('PUT', `/appointments/${appointmentId}/accept`, null, doctorToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.appointment.status === 'confirmed', 'Status should be confirmed');
    });

    // ==================== PAYMENTS ====================
    console.log('\n💳 Payment Routes');

    await test('POST /payments/simulate — simulate payment', async () => {
        const r = await request('POST', '/payments/simulate', {
            appointmentId: appointmentId,
        }, patientToken);
        assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.data)}`);
        assert(r.data.payment, 'Missing payment');
        assert(r.data.appointment.paymentStatus === 'paid', 'Should be paid');
    });

    await test('GET /payments/my — patient payments', async () => {
        const r = await request('GET', '/payments/my', null, patientToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(Array.isArray(r.data.payments), 'payments should be array');
        assert(r.data.payments.length > 0, 'Should have at least 1 payment');
    });

    // ==================== COMPLETE APPOINTMENT ====================
    console.log('\n✅ Complete Appointment Flow');

    await test('PUT /appointments/:id/complete — complete appointment', async () => {
        const r = await request('PUT', `/appointments/${appointmentId}/complete`, null, doctorToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.appointment.status === 'completed', 'Status should be completed');
    });

    // ==================== REVIEWS ====================
    console.log('\n⭐ Review Routes');

    await test('POST /reviews — create review', async () => {
        const r = await request('POST', '/reviews', {
            appointmentId: appointmentId,
            rating: 5,
            comment: 'Excellent doctor! Great experience.',
        }, patientToken);
        assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.data)}`);
        assert(r.data.review, 'Missing review');
    });

    await test('POST /reviews — duplicate review fails', async () => {
        const r = await request('POST', '/reviews', {
            appointmentId: appointmentId,
            rating: 4,
            comment: 'Duplicate',
        }, patientToken);
        assert(r.status === 400, `Expected 400, got ${r.status}`);
    });

    await test('GET /reviews/doctor/:doctorId — get doctor reviews', async () => {
        const r = await request('GET', `/reviews/doctor/${doctorProfileId}`);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(Array.isArray(r.data.reviews), 'reviews should be array');
    });

    // ==================== ADMIN (continued) ====================
    console.log('\n🛡️  Admin Routes (continued)');

    await test('GET /admin/doctors — all doctors', async () => {
        const r = await request('GET', '/admin/doctors', null, adminToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(Array.isArray(r.data.doctors), 'doctors should be array');
    });

    await test('GET /admin/users — all users', async () => {
        const r = await request('GET', '/admin/users', null, adminToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(Array.isArray(r.data.users), 'users should be array');
        // Find our test patient for block/unblock tests
        const testUser = r.data.users.find(u => u.email === testEmail);
        if (testUser) testUserId = testUser._id;
    });

    await test('PUT /admin/users/:id/block — block user', async () => {
        assert(testUserId, 'No test user ID found');
        const r = await request('PUT', `/admin/users/${testUserId}/block`, null, adminToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.user.isBlocked === true, 'Should be blocked');
    });

    await test('POST /auth/login — blocked user login fails', async () => {
        const r = await request('POST', '/auth/login', { email: testEmail, password: 'NewPass1234!' });
        assert(r.status === 403, `Expected 403, got ${r.status}`);
    });

    await test('PUT /admin/users/:id/unblock — unblock user', async () => {
        const r = await request('PUT', `/admin/users/${testUserId}/unblock`, null, adminToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.user.isBlocked === false, 'Should be unblocked');
    });

    await test('GET /admin/appointments — all appointments', async () => {
        const r = await request('GET', '/admin/appointments', null, adminToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(Array.isArray(r.data.appointments), 'appointments should be array');
    });

    // Create a second appointment for admin override test
    const nextTuesday = new Date(nextMonday);
    nextTuesday.setDate(nextTuesday.getDate() + 1);
    const tuesdayStr = nextTuesday.toISOString().split('T')[0];

    // Re-login patient (was blocked, token may be invalid)
    let freshPatientToken = '';
    await test('POST /auth/login — re-login patient after unblock', async () => {
        const r = await request('POST', '/auth/login', { email: testEmail, password: 'NewPass1234!' });
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        freshPatientToken = r.data.token;
    });

    let secondAppointmentId = '';
    await test('POST /appointments — create 2nd appointment for admin test', async () => {
        const r = await request('POST', '/appointments', {
            doctorId: doctorProfileId,
            date: tuesdayStr,
            timeSlot: '14:00 - 14:30',
        }, freshPatientToken);
        assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.data)}`);
        secondAppointmentId = r.data.appointment._id;
    });

    await test('PUT /admin/appointments/:id/status — override status', async () => {
        assert(secondAppointmentId, 'No second appointment ID');
        const r = await request('PUT', `/admin/appointments/${secondAppointmentId}/status`, { status: 'cancelled' }, adminToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.appointment.status === 'cancelled', 'Status should be cancelled');
    });

    await test('GET /admin/payments — all payments', async () => {
        const r = await request('GET', '/admin/payments', null, adminToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(Array.isArray(r.data.payments), 'payments should be array');
        assert(r.data.summary, 'Missing summary');
    });

    await test('GET /admin/reports — reports & analytics', async () => {
        const r = await request('GET', '/admin/reports', null, adminToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.platformStats, 'Missing platformStats');
        assert(Array.isArray(r.data.topDoctors), 'topDoctors should be array');
        assert(r.data.specDistribution, 'Missing specDistribution');
        assert(r.data.monthlyGrowth, 'Missing monthlyGrowth');
    });

    await test('GET /admin/settings — get settings', async () => {
        const r = await request('GET', '/admin/settings', null, adminToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.settings, 'Missing settings');
    });

    await test('PUT /admin/settings — update settings', async () => {
        const r = await request('PUT', '/admin/settings', {
            platformFeePercent: 12,
            maxAppointmentsPerDay: 25,
        }, adminToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.settings, 'Missing settings');
    });

    // Verify settings persisted
    await test('GET /admin/settings — verify updated settings', async () => {
        const r = await request('GET', '/admin/settings', null, adminToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.settings.platformFeePercent === 12, `Fee should be 12, got ${r.data.settings.platformFeePercent}`);
    });

    // Reset settings back
    await test('PUT /admin/settings — reset settings', async () => {
        const r = await request('PUT', '/admin/settings', {
            platformFeePercent: 10,
            maxAppointmentsPerDay: 20,
        }, adminToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
    });

    // ==================== CANCEL FLOW ====================
    console.log('\n🚫 Cancel Flow');

    let cancelAppointmentId = '';
    await test('POST /appointments — create appointment for cancel test', async () => {
        const nextWed = new Date(nextMonday);
        nextWed.setDate(nextWed.getDate() + 2);
        // Use a different slot
        const r = await request('POST', '/appointments', {
            doctorId: doctorProfileId,
            date: nextWed.toISOString().split('T')[0],
            timeSlot: '09:00 - 09:30',
        }, freshPatientToken);
        assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.data)}`);
        cancelAppointmentId = r.data.appointment._id;
    });

    await test('PUT /appointments/:id/cancel — patient cancel', async () => {
        const r = await request('PUT', `/appointments/${cancelAppointmentId}/cancel`, {
            reason: 'Changed my mind',
        }, freshPatientToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.appointment.status === 'cancelled', 'Should be cancelled');
    });

    // Reject flow
    let rejectAppointmentId = '';
    await test('POST /appointments — create appointment for reject test', async () => {
        const nextThurs = new Date(nextMonday);
        nextThurs.setDate(nextThurs.getDate() + 3);
        const r = await request('POST', '/appointments', {
            doctorId: doctorProfileId,
            date: nextThurs.toISOString().split('T')[0],
            timeSlot: '10:00 - 10:30',
        }, freshPatientToken);
        assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.data)}`);
        rejectAppointmentId = r.data.appointment._id;
    });

    await test('PUT /appointments/:id/reject — doctor reject', async () => {
        const r = await request('PUT', `/appointments/${rejectAppointmentId}/reject`, {
            reason: 'Schedule conflict',
        }, doctorToken);
        assert(r.status === 200, `Expected 200, got ${r.status}`);
        assert(r.data.appointment.status === 'cancelled', 'Should be cancelled');
    });

    // ==================== EDGE CASES ====================
    console.log('\n🔒 Edge Cases & Authorization');

    await test('GET /admin/dashboard — doctor token fails', async () => {
        const r = await request('GET', '/admin/dashboard', null, doctorToken);
        assert(r.status === 403, `Expected 403, got ${r.status}`);
    });

    await test('GET /doctors/me/profile — patient token fails', async () => {
        const r = await request('GET', '/doctors/me/profile', null, freshPatientToken);
        assert(r.status === 403, `Expected 403, got ${r.status}`);
    });

    await test('GET /appointments/doctor — patient token fails', async () => {
        const r = await request('GET', '/appointments/doctor', null, freshPatientToken);
        assert(r.status === 403, `Expected 403, got ${r.status}`);
    });

    await test('POST /appointments — doctor token fails', async () => {
        const r = await request('POST', '/appointments', {
            doctorId: doctorProfileId,
            date: dateStr,
            timeSlot: '11:00 - 11:30',
        }, doctorToken);
        assert(r.status === 403, `Expected 403, got ${r.status}`);
    });

    await test('GET /doctors/invalidid — 404 or 500', async () => {
        const r = await request('GET', '/doctors/000000000000000000000000');
        assert(r.status === 404 || r.status === 500, `Expected 404/500, got ${r.status}`);
    });

    // ==================== CLEANUP INFO ====================
    console.log('\n' + '═'.repeat(60));
    console.log(`\n📊 Results: ${results.passed} passed, ${results.failed} failed out of ${results.passed + results.failed} tests\n`);

    if (results.errors.length > 0) {
        console.log('❌ Failed tests:');
        results.errors.forEach(e => console.log(`   • ${e.name}: ${e.error}`));
    } else {
        console.log('🎉 All tests passed!\n');
    }

    console.log('⚠️  Test data created (can be cleaned up via admin panel):');
    console.log(`   Patient: ${testEmail}`);
    console.log(`   Doctor: ${docEmail}`);
    console.log('');
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
