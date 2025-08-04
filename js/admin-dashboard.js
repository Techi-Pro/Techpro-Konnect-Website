/**
 * Admin Dashboard JavaScript
 * Integrates with Techi-Pro Konnect API at https://techiproconnect.onrender.com/api/v1
 */

// API Configuration
const API_BASE_URL = 'https://techiproconnect.onrender.com/api/v1';
let selectedTechnicianId = null;
let currentDecision = null;

// Initialize dashboard when page loads
$(document).ready(function() {
    // Display user info from token
    displayUserInfo();
    
    checkAuthStatus();
    loadDashboardData();
    
    // Set up filter change listener
    $('#filter-status').on('change', function() {
        loadPendingReviews();
    });
});

/**
 * Display user information from JWT token
 */
function displayUserInfo() {
    const token = localStorage.getItem('admin_token');
    if (token) {
        try {
            // Decode JWT payload (simple base64 decode)
            const payload = JSON.parse(atob(token.split('.')[1]));
            console.log('Token payload:', payload);
            
            const userInfo = document.getElementById('user-info');
            if (userInfo) {
                userInfo.textContent = `Logged in as: ${payload.username || payload.email || 'Admin'} | Role: ${payload.role || 'Unknown'}`;
            }
        } catch (error) {
            console.error('Error decoding token:', error);
        }
    }
}

/**
 * Check if admin is authenticated
 */
function checkAuthStatus() {
    const token = localStorage.getItem('admin_token');
    if (!token) {
        // Redirect to login if no token
        window.location.href = 'admin-login.html';
        return;
    }
    
    // For now, we'll just check if token exists
    // Your API doesn't have a verify-token endpoint yet
    // You can add token validation by calling any protected admin endpoint
    testAdminAccess();
}

/**
 * Test admin access by calling a protected endpoint
 */
async function testAdminAccess() {
    try {
        const response = await makeAuthenticatedRequest('/kyc-admin/kyc-statistics');
        if (!response || !response.ok) {
            console.log('Admin access failed:', response ? response.status : 'No response');
            if (response && response.status === 403) {
                // User doesn't have admin privileges
                showError('stats-grid', 'Access denied. Admin privileges required.');
                setTimeout(() => {
                    localStorage.removeItem('admin_token');
                    window.location.href = 'admin-login.html';
                }, 3000);
            } else {
                localStorage.removeItem('admin_token');
                window.location.href = 'admin-login.html';
            }
        }
    } catch (error) {
        console.error('Admin access test failed:', error);
        showError('stats-grid', 'Failed to connect to admin services.');
        setTimeout(() => {
            localStorage.removeItem('admin_token');
            window.location.href = 'admin-login.html';
        }, 3000);
    }
}

/**
 * Make authenticated API request
 */
async function makeAuthenticatedRequest(endpoint, options = {}) {
    const token = localStorage.getItem('admin_token');
    
    if (!token) {
        console.log('No admin token found');
        window.location.href = 'admin-login.html';
        return null;
    }
    
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    };
    
    console.log(`Making request to: ${API_BASE_URL}${endpoint}`);
    console.log('With token:', token.substring(0, 20) + '...');
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        ...defaultOptions
    });
    
    console.log(`Response status: ${response.status}`);
    
    if (response.status === 401) {
        console.log('Token expired or invalid');
        localStorage.removeItem('admin_token');
        window.location.href = 'admin-login.html';
        return null;
    }
    
    if (response.status === 403) {
        console.log('Access forbidden - not admin or insufficient privileges');
        // Show API status alert instead of immediate redirect
        const alert = document.getElementById('api-status-alert');
        if (alert) {
            alert.style.display = 'block';
        }
        // Don't redirect immediately, let the calling function handle it
    }
    
    return response;
}

/**
 * Load dashboard data
 */
async function loadDashboardData() {
    try {
        showLoading('stats-grid');
        
        const response = await makeAuthenticatedRequest('/kyc-admin/kyc-statistics');
        if (response && response.ok) {
            const data = await response.json();
            displayStatistics(data);
        } else if (response && response.status === 403) {
            showError('stats-grid', 'Access denied. Please ensure you have admin privileges.');
            // Don't auto-redirect on 403, let user see the error
        } else {
            showError('stats-grid', 'Failed to load statistics');
        }
        
        // Load recent submissions
        loadRecentSubmissions();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('stats-grid', 'Failed to load dashboard data: ' + error.message);
    }
}

/**
 * Display KYC statistics
 */
function displayStatistics(stats) {
    const statsGrid = document.getElementById('stats-grid');
    statsGrid.innerHTML = `
        <div class="stat-card">
            <h3>${stats.pending || 0}</h3>
            <p>Pending Firebase KYC</p>
            <small class="text-muted">Awaiting Firebase processing</small>
        </div>
        <div class="stat-card">
            <h3>${stats.firebaseVerified || 0}</h3>
            <p>Firebase Verified</p>
            <small class="text-muted">Passed Firebase verification</small>
        </div>
        <div class="stat-card">
            <h3>${stats.awaitingAdminReview || 0}</h3>
            <p>Awaiting Admin Review</p>
            <small class="text-muted">Requires manual approval</small>
        </div>
        <div class="stat-card">
            <h3>${stats.adminApproved || 0}</h3>
            <p>Admin Approved</p>
            <small class="text-muted">Fully verified technicians</small>
        </div>
    `;
}

/**
 * Load recent KYC submissions
 */
async function loadRecentSubmissions() {
    try {
        // Since there's no specific recent submissions endpoint, 
        // we'll use the pending-review endpoint with a small limit
        const response = await makeAuthenticatedRequest('/kyc-admin/technicians/pending-review?page=1&limit=5');
        if (response && response.ok) {
            const data = await response.json();
            displayRecentSubmissions(data.items || []);
        }
    } catch (error) {
        console.error('Error loading recent submissions:', error);
        // Show empty state if we can't load recent submissions
        const container = document.getElementById('recent-submissions');
        container.innerHTML = '<p class="text-muted">Unable to load recent submissions</p>';
    }
}

/**
 * Display recent submissions
 */
function displayRecentSubmissions(submissions) {
    const container = document.getElementById('recent-submissions');
    
    if (submissions.length === 0) {
        container.innerHTML = '<p class="text-muted">No recent submissions</p>';
        return;
    }
    
    container.innerHTML = submissions.map(sub => `
        <div class="d-flex justify-content-between align-items-center mb-2 p-2 border-bottom">
            <div>
                <strong>${sub.username}</strong>
                <br>
                <small class="text-muted">${sub.category?.name || 'N/A'}</small>
            </div>
            <div class="text-end">
                <span class="status ${(sub.firebaseKycStatus || '').toLowerCase()}">${sub.firebaseKycStatus}</span>
                <br>
                <small class="text-muted">${formatDate(sub.createdAt)}</small>
            </div>
        </div>
    `).join('');
}

/**
 * Load pending reviews
 */
async function loadPendingReviews() {
    try {
        showLoading('pending-reviews-list');
        
        const filterStatus = document.getElementById('filter-status').value;
        let endpoint = '/kyc-admin/technicians/pending-review?page=1&limit=20';
        
        if (filterStatus) {
            endpoint += `&status=${filterStatus}`;
        }
        
        const response = await makeAuthenticatedRequest(endpoint);
        if (response && response.ok) {
            const data = await response.json();
            displayPendingReviews(data.items || []);
        } else {
            showError('pending-reviews-list', 'Failed to load pending reviews');
        }
        
    } catch (error) {
        console.error('Error loading pending reviews:', error);
        showError('pending-reviews-list', 'Failed to load pending reviews');
    }
}

/**
 * Display pending reviews
 */
function displayPendingReviews(reviews) {
    const container = document.getElementById('pending-reviews-list');
    
    if (reviews.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="bi-check-circle display-1 text-success"></i>
                <h4 class="mt-3">No pending reviews</h4>
                <p class="text-muted">All technicians have been reviewed!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = reviews.map(technician => {
        const firebaseData = technician.firebaseKycData || {};
        const confidenceScore = firebaseData.confidenceScore || 0;
        const documentUrls = firebaseData.documentUrls || [];
        
        return `
            <div class="review-card">
                <div class="row">
                    <div class="col-md-3">
                        <div class="technician-info">
                            <h5>${technician.username}</h5>
                            <p class="mb-1"><i class="bi-envelope"></i> ${technician.email}</p>
                            <p class="mb-1"><i class="bi-phone"></i> ${technician.phoneNumber || 'N/A'}</p>
                            <p class="mb-0"><i class="bi-tools"></i> ${technician.category?.name || 'N/A'}</p>
                        </div>
                    </div>
                    
                    <div class="col-md-3">
                        <div class="firebase-results">
                            <span class="status ${(technician.firebaseKycStatus || '').toLowerCase().replace('_', '-')}">
                                ${technician.firebaseKycStatus || 'PENDING'}
                            </span>
                            <div class="confidence-score mt-2">
                                Confidence: ${(confidenceScore * 100).toFixed(1)}%
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-3">
                        <div class="document-preview">
                            ${documentUrls.slice(0, 3).map((url, index) => `
                                <img src="${url}" alt="Document ${index + 1}" class="doc-thumbnail" 
                                     onclick="openImageModal('${url}', 'Document ${index + 1}')">
                            `).join('')}
                            ${documentUrls.length > 3 ? `<span class="badge bg-secondary">+${documentUrls.length - 3} more</span>` : ''}
                        </div>
                    </div>
                    
                    <div class="col-md-3">
                        <div class="actions">
                            <button class="btn btn-outline-primary btn-sm" onclick="viewTechnicianDetails('${technician.id}')">
                                <i class="bi-eye"></i> View Details
                            </button>
                            <button class="btn btn-success btn-sm" onclick="quickApprove('${technician.id}')">
                                <i class="bi-check"></i> Approve
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="quickReject('${technician.id}')">
                                <i class="bi-x"></i> Reject
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * View technician details in modal
 */
async function viewTechnicianDetails(technicianId) {
    try {
        selectedTechnicianId = technicianId;
        
        // Since there's no specific details endpoint, we'll get the technician from the pending list
        // and show available information
        const response = await makeAuthenticatedRequest('/kyc-admin/technicians/pending-review?page=1&limit=100');
        if (response && response.ok) {
            const data = await response.json();
            const technician = data.items.find(t => t.id === technicianId);
            
            if (technician) {
                displayTechnicianModal(technician);
                
                const modal = new bootstrap.Modal(document.getElementById('technicianModal'));
                modal.show();
            } else {
                alert('Technician not found');
            }
        }
    } catch (error) {
        console.error('Error loading technician details:', error);
        alert('Failed to load technician details');
    }
}

/**
 * Display technician details in modal
 */
function displayTechnicianModal(technician) {
    const firebaseData = technician.firebaseKycData || {};
    const documentUrls = firebaseData.documentUrls || [];
    
    const modalBody = document.getElementById('modal-body-content');
    modalBody.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6>Personal Information</h6>
                <table class="table table-sm">
                    <tr><td><strong>Username:</strong></td><td>${technician.username || 'N/A'}</td></tr>
                    <tr><td><strong>Email:</strong></td><td>${technician.email || 'N/A'}</td></tr>
                    <tr><td><strong>Phone:</strong></td><td>${technician.phoneNumber || 'N/A'}</td></tr>
                    <tr><td><strong>Category:</strong></td><td>${technician.category?.name || 'N/A'}</td></tr>
                    <tr><td><strong>Location:</strong></td><td>${technician.location || 'N/A'}</td></tr>
                    <tr><td><strong>Registration:</strong></td><td>${formatDate(technician.createdAt)}</td></tr>
                </table>
            </div>
            
            <div class="col-md-6">
                <h6>Firebase KYC Results</h6>
                <table class="table table-sm">
                    <tr><td><strong>Status:</strong></td><td>
                        <span class="status ${(technician.firebaseKycStatus || '').toLowerCase().replace('_', '-')}">${technician.firebaseKycStatus || 'PENDING'}</span>
                    </td></tr>
                    <tr><td><strong>Confidence:</strong></td><td>${((firebaseData.confidenceScore || 0) * 100).toFixed(1)}%</td></tr>
                    <tr><td><strong>Verification Status:</strong></td><td>${technician.verificationStatus || 'PENDING'}</td></tr>
                    <tr><td><strong>Availability:</strong></td><td>${technician.availabilityStatus || 'N/A'}</td></tr>
                    <tr><td><strong>Last Updated:</strong></td><td>${formatDate(technician.updatedAt)}</td></tr>
                </table>
            </div>
        </div>
        
        <hr>
        
        <h6>Uploaded Documents</h6>
        <div class="row">
            ${documentUrls.length > 0 ? documentUrls.map((url, index) => `
                <div class="col-md-4 mb-3">
                    <img src="${url}" alt="Document ${index + 1}" class="document-full" 
                         onclick="openImageModal('${url}', 'Document ${index + 1}')">
                    <p class="text-center mt-1"><small>Document ${index + 1}</small></p>
                </div>
            `).join('') : '<p class="text-muted">No documents uploaded</p>'}
        </div>
        
        ${firebaseData.adminNotes ? `
            <hr>
            <h6>Previous Admin Notes</h6>
            <div class="alert alert-info">${firebaseData.adminNotes}</div>
        ` : ''}
        
        ${firebaseData.faceMatch !== undefined ? `
            <hr>
            <h6>Additional Firebase Data</h6>
            <div class="row">
                <div class="col-md-6">
                    <strong>Face Match:</strong> ${firebaseData.faceMatch ? 'Yes' : 'No'}
                </div>
                <div class="col-md-6">
                    <strong>Document Type:</strong> ${firebaseData.documentType || 'N/A'}
                </div>
            </div>
        ` : ''}
    `;
}

/**
 * Quick approve technician
 */
function quickApprove(technicianId) {
    selectedTechnicianId = technicianId;
    currentDecision = 'approve';
    
    const modal = new bootstrap.Modal(document.getElementById('notesModal'));
    document.querySelector('#notesModal .modal-title').textContent = 'Approve Technician';
    document.getElementById('review-notes').placeholder = 'Enter approval notes (optional)...';
    modal.show();
}

/**
 * Quick reject technician
 */
function quickReject(technicianId) {
    selectedTechnicianId = technicianId;
    currentDecision = 'reject';
    
    const modal = new bootstrap.Modal(document.getElementById('notesModal'));
    document.querySelector('#notesModal .modal-title').textContent = 'Reject Technician';
    document.getElementById('review-notes').placeholder = 'Enter rejection reason (required)...';
    modal.show();
}

/**
 * Handle decision from modal
 */
function handleDecision(decision) {
    currentDecision = decision;
    
    // Close details modal if open
    const detailsModal = bootstrap.Modal.getInstance(document.getElementById('technicianModal'));
    if (detailsModal) {
        detailsModal.hide();
    }
    
    // Open notes modal
    const notesModal = new bootstrap.Modal(document.getElementById('notesModal'));
    document.querySelector('#notesModal .modal-title').textContent = 
        decision === 'approve' ? 'Approve Technician' : 'Reject Technician';
    document.getElementById('review-notes').placeholder = 
        decision === 'approve' ? 'Enter approval notes (optional)...' : 'Enter rejection reason (required)...';
    notesModal.show();
}

/**
 * Submit final decision
 */
async function submitDecision() {
    const notes = document.getElementById('review-notes').value.trim();
    
    if (currentDecision === 'reject' && !notes) {
        alert('Rejection reason is required');
        return;
    }
    
    try {
        // Use the new KYC verification function
        await performKycVerification(selectedTechnicianId, currentDecision, notes);
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('notesModal'));
        modal.hide();
        
        // Clear form
        document.getElementById('review-notes').value = '';
        
        // Refresh data
        refreshData();
    } catch (error) {
        console.error('Error submitting decision:', error);
        alert('Failed to submit decision');
    }
}

/**
 * Navigation functions
 */
function showDashboard() {
    updateActiveNav('Dashboard');
    hideAllContent();
    document.getElementById('dashboard-content').style.display = 'block';
    loadDashboardData();
}

function showPendingReviews() {
    updateActiveNav('KYC Reviews');
    hideAllContent();
    document.getElementById('pending-reviews-content').style.display = 'block';
    loadPendingReviews();
}

function showAllUsers() {
    updateActiveNav('All Users');
    hideAllContent();
    document.getElementById('all-users-content').style.display = 'block';
    loadAllUsers();
}

function showAllTechnicians() {
    updateActiveNav('All Technicians');
    hideAllContent();
    document.getElementById('all-technicians-content').style.display = 'block';
    loadAllTechnicians();
}

function showSystemOverview() {
    updateActiveNav('System Overview');
    hideAllContent();
    document.getElementById('system-overview-content').style.display = 'block';
    loadAdminOverview();
    checkSystemHealth();
    getAnalyticsSummary();
}

function showCategories() {
    updateActiveNav('Categories');
    hideAllContent();
    document.getElementById('categories-content').style.display = 'block';
    loadServiceCategories();
}

function showBookings() {
    updateActiveNav('Appointments');
    hideAllContent();
    document.getElementById('appointments-content').style.display = 'block';
    loadAppointments();
}

function showSettings() {
    updateActiveNav('Settings');
    hideAllContent();
    document.getElementById('settings-content').style.display = 'block';
    loadSettings();
}

function hideAllContent() {
    const contentSections = [
        'dashboard-content',
        'pending-reviews-content', 
        'all-users-content',
        'all-technicians-content',
        'system-overview-content',
        'categories-content',
        'appointments-content',
        'settings-content',
        'services-content',
        'payments-content'
    ];
    
    contentSections.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = 'none';
        }
    });
}

function updateActiveNav(section) {
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        if (link.textContent.trim().includes(section)) {
            link.classList.add('active');
        }
    });
}

/**
 * Utility functions
 */
function refreshData() {
    const currentView = document.getElementById('dashboard-content').style.display !== 'none' ? 'dashboard' : 'reviews';
    
    if (currentView === 'dashboard') {
        loadDashboardData();
    } else {
        loadPendingReviews();
        loadDashboardData(); // Also refresh stats
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('admin_token');
        window.location.href = 'admin-login.html';
    }
}

function showLoading(containerId) {
    document.getElementById(containerId).innerHTML = `
        <div class="loading">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Loading...</p>
        </div>
    `;
}

function showError(containerId, message) {
    document.getElementById(containerId).innerHTML = `
        <div class="error">
            <i class="bi-exclamation-triangle"></i> ${message}
        </div>
    `;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function openImageModal(imageUrl, title) {
    // Create a simple image modal
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">${title}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body text-center">
                    <img src="${imageUrl}" alt="${title}" style="max-width: 100%; height: auto;">
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // Remove modal from DOM when hidden
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
}

function showSuccessToast(message) {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = 'position-fixed top-0 end-0 p-3';
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        <div class="toast show" role="alert">
            <div class="toast-header">
                <i class="bi-check-circle-fill text-success me-2"></i>
                <strong class="me-auto">Success</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (document.body.contains(toast)) {
            document.body.removeChild(toast);
        }
    }, 3000);
}

/**
 * Complete Dashboard Implementation
 * Additional functions for full admin functionality
 */

// =======================
// USER MANAGEMENT
// =======================

/**
 * Load all users with pagination and filters
 */
async function loadAllUsers(page = 1, limit = 10, filters = {}) {
    try {
        console.log('🔧 Loading all users...');
        let endpoint = `/admin/users?page=${page}&limit=${limit}`;
        
        // Add filters if provided
        if (filters.role) endpoint += `&role=${filters.role}`;
        if (filters.status) endpoint += `&status=${filters.status}`;
        if (filters.search) endpoint += `&search=${encodeURIComponent(filters.search)}`;
        
        const response = await makeAuthenticatedRequest(endpoint);
        if (response && response.ok) {
            const data = await response.json();
            displayUsersTable(data);
            return data;
        } else {
            showError('users-container', 'Failed to load users');
        }
    } catch (error) {
        console.error('❌ Error loading users:', error);
        showError('users-container', 'Error loading users');
    }
}

/**
 * Load all technicians with filters
 */
async function loadAllTechnicians(page = 1, limit = 10, status = null, search = null) {
    try {
        console.log('🔧 Loading all technicians...');
        let endpoint = `/admin/technicians?page=${page}&limit=${limit}`;
        
        if (status) endpoint += `&status=${status}`;
        if (search) endpoint += `&search=${encodeURIComponent(search)}`;
        
        const response = await makeAuthenticatedRequest(endpoint);
        if (response && response.ok) {
            const data = await response.json();
            displayTechniciansTable(data);
            return data;
        } else {
            showError('technicians-container', 'Failed to load technicians');
        }
    } catch (error) {
        console.error('❌ Error loading technicians:', error);
        showError('technicians-container', 'Error loading technicians');
    }
}

/**
 * Get individual technician KYC status
 */
async function getTechnicianKycStatus(technicianId) {
    try {
        console.log(`🔧 Getting KYC status for technician ${technicianId}`);
        const response = await makeAuthenticatedRequest(`/technicians/${technicianId}/kyc-status`);
        
        if (response && response.ok) {
            const data = await response.json();
            return data;
        } else {
            console.error('❌ Failed to get KYC status');
            return null;
        }
    } catch (error) {
        console.error('❌ Error getting KYC status:', error);
        return null;
    }
}

// =======================
// SYSTEM MANAGEMENT
// =======================

/**
 * Load admin overview/dashboard summary
 */
async function loadAdminOverview() {
    try {
        console.log('🔧 Loading admin overview...');
        const response = await makeAuthenticatedRequest('/admin/overview');
        
        if (response && response.ok) {
            const data = await response.json();
            displayAdminOverview(data);
            return data;
        } else {
            showError('overview-container', 'Failed to load overview');
        }
    } catch (error) {
        console.error('❌ Error loading overview:', error);
        showError('overview-container', 'Error loading overview');
    }
}

/**
 * Check system health
 */
async function checkSystemHealth() {
    try {
        console.log('🔧 Checking system health...');
        const response = await makeAuthenticatedRequest('/admin/system/health');
        
        if (response && response.ok) {
            const data = await response.json();
            displaySystemHealth(data);
            return data;
        } else {
            showError('health-container', 'Failed to check system health');
        }
    } catch (error) {
        console.error('❌ Error checking system health:', error);
        showError('health-container', 'Error checking system health');
    }
}

/**
 * Get analytics summary
 */
async function getAnalyticsSummary(period = '30d') {
    try {
        console.log(`🔧 Getting analytics summary for period: ${period}`);
        const response = await makeAuthenticatedRequest(`/admin/analytics/summary?period=${period}`);
        
        if (response && response.ok) {
            const data = await response.json();
            displayAnalyticsSummary(data);
            return data;
        } else {
            showError('analytics-container', 'Failed to load analytics');
        }
    } catch (error) {
        console.error('❌ Error loading analytics:', error);
        showError('analytics-container', 'Error loading analytics');
    }
}

/**
 * Load service categories
 */
async function loadServiceCategories() {
    try {
        console.log('🔧 Loading service categories...');
        const response = await makeAuthenticatedRequest('/admin/categories');
        
        if (response && response.ok) {
            const data = await response.json();
            displayServiceCategories(data);
            return data;
        } else {
            showError('categories-container', 'Failed to load categories');
        }
    } catch (error) {
        console.error('❌ Error loading categories:', error);
        showError('categories-container', 'Error loading categories');
    }
}

// =======================
// KYC VERIFICATION ACTIONS
// =======================

/**
 * Perform final KYC verification (approve/reject)
 */
async function performKycVerification(technicianId, decision, adminNotes = '') {
    try {
        console.log(`🔧 Performing KYC verification: ${decision} for technician ${technicianId}`);
        
        const response = await makeAuthenticatedRequest(`/kyc-admin/technicians/${technicianId}/final-verification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                decision: decision,
                adminNotes: adminNotes
            })
        });
        
        if (response && response.ok) {
            const data = await response.json();
            showSuccessToast(`Technician ${decision}d successfully`);
            
            // Refresh the pending reviews list
            loadPendingReviews();
            loadDashboardData();
            
            return data;
        } else {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            showError('verification-error', errorData.message || `Failed to ${decision} technician`);
        }
    } catch (error) {
        console.error(`❌ Error performing KYC verification:`, error);
        showError('verification-error', `Error ${decision}ing technician`);
    }
}

// =======================
// DISPLAY FUNCTIONS
// =======================

/**
 * Display users table
 */
function displayUsersTable(data) {
    const container = document.getElementById('users-container');
    if (!container) return;
    
    const users = data.items || data.users || [];
    const total = data.total || users.length;
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">All Users (${total})</h5>
                <div class="btn-group" role="group">
                    <button type="button" class="btn btn-outline-primary btn-sm" onclick="filterUsers('all')">All</button>
                    <button type="button" class="btn btn-outline-primary btn-sm" onclick="filterUsers('USER')">Users</button>
                    <button type="button" class="btn btn-outline-primary btn-sm" onclick="filterUsers('TECHNICIAN')">Technicians</button>
                    <button type="button" class="btn btn-outline-primary btn-sm" onclick="filterUsers('ADMIN')">Admins</button>
                </div>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(user => `
                                <tr>
                                    <td>${user.username || 'N/A'}</td>
                                    <td>${user.email}</td>
                                    <td><span class="badge bg-${user.role === 'ADMIN' ? 'danger' : user.role === 'TECHNICIAN' ? 'warning' : 'primary'}">${user.role}</span></td>
                                    <td><span class="badge bg-${user.isActive ? 'success' : 'secondary'}">${user.isActive ? 'Active' : 'Inactive'}</span></td>
                                    <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <button class="btn btn-sm btn-outline-primary" onclick="viewUserDetails('${user.id}')">
                                            <i class="bi-eye"></i>
                                        </button>
                                        <button class="btn btn-sm btn-outline-warning" onclick="editUser('${user.id}')">
                                            <i class="bi-pencil"></i>
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${user.id}')">
                                            <i class="bi-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

/**
 * Display technicians table
 */
function displayTechniciansTable(data) {
    const container = document.getElementById('technicians-container');
    if (!container) return;
    
    const technicians = data.items || data.technicians || [];
    const total = data.total || technicians.length;
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">All Technicians (${total})</h5>
                <div class="btn-group" role="group">
                    <button type="button" class="btn btn-outline-success btn-sm" onclick="filterTechnicians('verified')">Verified</button>
                    <button type="button" class="btn btn-outline-warning btn-sm" onclick="filterTechnicians('pending')">Pending</button>
                    <button type="button" class="btn btn-outline-danger btn-sm" onclick="filterTechnicians('rejected')">Rejected</button>
                </div>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Category</th>
                                <th>Verification Status</th>
                                <th>Firebase KYC</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${technicians.map(tech => `
                                <tr>
                                    <td>${tech.username || 'N/A'}</td>
                                    <td>${tech.email}</td>
                                    <td>${tech.category?.name || 'N/A'}</td>
                                    <td><span class="badge bg-${tech.verificationStatus === 'VERIFIED' ? 'success' : tech.verificationStatus === 'REJECTED' ? 'danger' : 'warning'}">${tech.verificationStatus}</span></td>
                                    <td><span class="badge bg-${tech.firebaseKycStatus === 'FIREBASE_VERIFIED' ? 'success' : tech.firebaseKycStatus === 'FIREBASE_REJECTED' ? 'danger' : 'secondary'}">${tech.firebaseKycStatus || 'PENDING'}</span></td>
                                    <td>${new Date(tech.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <button class="btn btn-sm btn-outline-primary" onclick="viewTechnicianDetails('${tech.id}')">
                                            <i class="bi-eye"></i>
                                        </button>
                                        <button class="btn btn-sm btn-outline-warning" onclick="editTechnician('${tech.id}')">
                                            <i class="bi-pencil"></i>
                                        </button>
                                        <button class="btn btn-sm btn-outline-info" onclick="viewKycStatus('${tech.id}')">
                                            KYC
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

/**
 * Display admin overview
 */
function displayAdminOverview(data) {
    const container = document.getElementById('overview-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="row">
            <div class="col-md-3 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h3 class="text-primary">${data.totalUsers || 0}</h3>
                        <p class="mb-0">Total Users</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h3 class="text-success">${data.activeTechnicians || 0}</h3>
                        <p class="mb-0">Active Technicians</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h3 class="text-warning">${data.pendingVerifications || 0}</h3>
                        <p class="mb-0">Pending KYC</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h3 class="text-info">${data.totalOrders || 0}</h3>
                        <p class="mb-0">Total Orders</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Display system health status
 */
function displaySystemHealth(data) {
    const container = document.getElementById('health-container');
    if (!container) return;
    
    const overallHealth = data.status === 'healthy' ? 'success' : 'danger';
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h5 class="mb-0">
                    System Health 
                    <span class="badge bg-${overallHealth}">${data.status || 'Unknown'}</span>
                </h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <h6>Database</h6>
                        <p class="mb-1">Status: <span class="badge bg-${data.database?.status === 'connected' ? 'success' : 'danger'}">${data.database?.status || 'Unknown'}</span></p>
                        <p class="mb-3">Response Time: ${data.database?.responseTime || 'N/A'}ms</p>
                    </div>
                    <div class="col-md-6">
                        <h6>API Services</h6>
                        <p class="mb-1">Status: <span class="badge bg-${data.api?.status === 'operational' ? 'success' : 'danger'}">${data.api?.status || 'Unknown'}</span></p>
                        <p class="mb-3">Uptime: ${data.api?.uptime || 'N/A'}</p>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <h6>Firebase KYC</h6>
                        <p class="mb-1">Status: <span class="badge bg-${data.firebase?.status === 'operational' ? 'success' : 'warning'}">${data.firebase?.status || 'Unknown'}</span></p>
                    </div>
                    <div class="col-md-6">
                        <h6>Memory Usage</h6>
                        <p class="mb-1">${data.memory?.used || 'N/A'} / ${data.memory?.total || 'N/A'}</p>
                        <div class="progress">
                            <div class="progress-bar" style="width: ${data.memory?.percentage || 0}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Display analytics summary
 */
function displayAnalyticsSummary(data) {
    const container = document.getElementById('analytics-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h5 class="mb-0">Analytics Summary</h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-4 mb-3">
                        <h6>New Registrations</h6>
                        <h3 class="text-primary">${data.newRegistrations || 0}</h3>
                        <small class="text-muted">Last 30 days</small>
                    </div>
                    <div class="col-md-4 mb-3">
                        <h6>KYC Completions</h6>
                        <h3 class="text-success">${data.kycCompletions || 0}</h3>
                        <small class="text-muted">Last 30 days</small>
                    </div>
                    <div class="col-md-4 mb-3">
                        <h6>Active Users</h6>
                        <h3 class="text-info">${data.activeUsers || 0}</h3>
                        <small class="text-muted">Last 30 days</small>
                    </div>
                </div>
                <hr>
                <div class="row">
                    <div class="col-md-6">
                        <h6>Top Categories</h6>
                        <ul class="list-unstyled">
                            ${(data.topCategories || []).map(cat => `
                                <li class="d-flex justify-content-between">
                                    <span>${cat.name}</span>
                                    <span class="badge bg-secondary">${cat.count}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    <div class="col-md-6">
                        <h6>Verification Stats</h6>
                        <p class="mb-1">Approved: <span class="text-success">${data.approvedCount || 0}</span></p>
                        <p class="mb-1">Rejected: <span class="text-danger">${data.rejectedCount || 0}</span></p>
                        <p class="mb-1">Pending: <span class="text-warning">${data.pendingCount || 0}</span></p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Display service categories
 */
function displayServiceCategories(data) {
    const container = document.getElementById('categories-container');
    if (!container) return;
    
    const categories = data.categories || data || [];
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Service Categories (${categories.length})</h5>
                <button class="btn btn-primary btn-sm" onclick="addNewCategory()">
                    <i class="bi-plus"></i> Add Category
                </button>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Description</th>
                                <th>Technicians</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${categories.map(category => `
                                <tr>
                                    <td>${category.name}</td>
                                    <td>${category.description || 'N/A'}</td>
                                    <td>${category.technicianCount || 0}</td>
                                    <td><span class="badge bg-${category.isActive ? 'success' : 'secondary'}">${category.isActive ? 'Active' : 'Inactive'}</span></td>
                                    <td>${new Date(category.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <button class="btn btn-sm btn-outline-primary" onclick="editCategory('${category.id}')">
                                            <i class="bi-pencil"></i>
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory('${category.id}')">
                                            <i class="bi-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// =======================
// HELPER FUNCTIONS
// =======================

/**
 * Filter users by role
 */
function filterUsers(role) {
    const filters = role === 'all' ? {} : { role: role };
    loadAllUsers(1, 10, filters);
}

/**
 * Filter technicians by status
 */
function filterTechnicians(status) {
    loadAllTechnicians(1, 10, status);
}

/**
 * View user details
 */
async function viewUserDetails(userId) {
    try {
        console.log(`Viewing user details for: ${userId}`);
        const userData = await getUserDetails(userId);
        if (userData) {
            showUserDetailsModal(userData);
        } else {
            alert('Failed to load user details');
        }
    } catch (error) {
        console.error('Error viewing user details:', error);
        alert('Error loading user details');
    }
}

/**
 * View technician details
 */
async function viewTechnicianDetails(technicianId) {
    try {
        console.log(`Viewing technician details for: ${technicianId}`);
        const technicianData = await getTechnicianDetails(technicianId);
        if (technicianData) {
            showTechnicianDetailsModal(technicianData);
        } else {
            // Fallback to existing KYC modal if detailed data not available
            viewTechnicianModal(technicianId);
        }
    } catch (error) {
        console.error('Error viewing technician details:', error);
        viewTechnicianModal(technicianId); // Fallback
    }
}

/**
 * View KYC status
 */
async function viewKycStatus(technicianId) {
    const kycData = await getTechnicianKycStatus(technicianId);
    if (kycData) {
        console.log('KYC Status:', kycData);
        // Show KYC status modal
        showKycStatusModal(kycData);
    }
}

// =======================
// CATEGORY MANAGEMENT CRUD
// =======================

/**
 * Add new category
 */
async function addNewCategory() {
    // Reset form and show modal
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryModalTitle').textContent = 'Add New Category';
    document.getElementById('categoryActive').checked = true;
    
    // Store current action
    window.currentCategoryAction = 'create';
    window.currentCategoryId = null;
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('categoryModal'));
    modal.show();
}

/**
 * Edit category
 */
async function editCategory(categoryId) {
    try {
        // First get the current category data
        const response = await makeAuthenticatedRequest(`/admin/categories/${categoryId}`);
        if (!response || !response.ok) {
            alert('Failed to load category details');
            return;
        }
        
        const category = await response.json();
        
        // Populate form with existing data
        document.getElementById('categoryName').value = category.name;
        document.getElementById('categoryDescription').value = category.description || '';
        document.getElementById('categoryActive').checked = category.isActive;
        document.getElementById('categoryModalTitle').textContent = 'Edit Category';
        
        // Store current action
        window.currentCategoryAction = 'edit';
        window.currentCategoryId = categoryId;
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('categoryModal'));
        modal.show();
        
    } catch (error) {
        console.error('❌ Error loading category for edit:', error);
        alert('Error loading category details. Please try again.');
    }
}

/**
 * Save category from modal
 */
async function saveCategoryFromModal() {
    const name = document.getElementById('categoryName').value.trim();
    const description = document.getElementById('categoryDescription').value.trim();
    const isActive = document.getElementById('categoryActive').checked;
    
    if (!name) {
        alert('Category name is required!');
        return;
    }
    
    const categoryData = {
        name: name,
        description: description,
        isActive: isActive
    };
    
    try {
        let response;
        
        if (window.currentCategoryAction === 'create') {
            console.log('🔧 Creating new category...');
            response = await makeAuthenticatedRequest('/admin/categories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(categoryData)
            });
        } else if (window.currentCategoryAction === 'edit') {
            console.log(`🔧 Updating category ${window.currentCategoryId}...`);
            response = await makeAuthenticatedRequest(`/admin/categories/${window.currentCategoryId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(categoryData)
            });
        }
        
        if (response && response.ok) {
            const action = window.currentCategoryAction === 'create' ? 'created' : 'updated';
            showSuccessToast(`Category ${action} successfully!`);
            
            // Hide modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('categoryModal'));
            modal.hide();
            
            // Refresh categories list
            loadServiceCategories();
        } else {
            const errorData = await response.json();
            alert(`Failed to save category: ${errorData.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('❌ Error saving category:', error);
        alert('Error saving category. Please try again.');
    }
}

/**
 * Delete category
 */
async function deleteCategory(categoryId) {
    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
        return;
    }
    
    try {
        console.log(`🔧 Deleting category ${categoryId}...`);
        const response = await makeAuthenticatedRequest(`/admin/categories/${categoryId}`, {
            method: 'DELETE'
        });
        
        if (response && response.ok) {
            showSuccessToast('Category deleted successfully!');
            loadServiceCategories(); // Refresh the categories list
        } else {
            const errorData = await response.json();
            alert(`Failed to delete category: ${errorData.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('❌ Error deleting category:', error);
        alert('Error deleting category. Please try again.');
    }
}

// =======================
// SETTINGS MANAGEMENT
// =======================

/**
 * Load settings
 */
async function loadSettings() {
    try {
        console.log('🔧 Loading settings...');
        const response = await makeAuthenticatedRequest('/admin/settings');
        
        if (response && response.ok) {
            const data = await response.json();
            displaySettings(data);
            return data;
        } else {
            showError('settings-container', 'Failed to load settings');
        }
    } catch (error) {
        console.error('❌ Error loading settings:', error);
        showError('settings-container', 'Error loading settings');
    }
}

/**
 * Update settings
 */
async function updateSettings(settingsData) {
    try {
        console.log('🔧 Updating settings...');
        const response = await makeAuthenticatedRequest('/admin/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settingsData)
        });
        
        if (response && response.ok) {
            showSuccessToast('Settings updated successfully!');
            loadSettings(); // Refresh settings
            return true;
        } else {
            const errorData = await response.json();
            alert(`Failed to update settings: ${errorData.message || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Error updating settings:', error);
        alert('Error updating settings. Please try again.');
        return false;
    }
}

// =======================
// APPOINTMENTS MANAGEMENT
// =======================

/**
 * Load appointments
 */
async function loadAppointments() {
    try {
        console.log('🔧 Loading appointments...');
        const response = await makeAuthenticatedRequest('/admin/appointments');
        
        if (response && response.ok) {
            const data = await response.json();
            displayAppointments(data);
            return data;
        } else {
            showError('appointments-container', 'Failed to load appointments');
        }
    } catch (error) {
        console.error('❌ Error loading appointments:', error);
        showError('appointments-container', 'Error loading appointments');
    }
}

/**
 * Get appointment details
 */
async function getAppointmentDetails(appointmentId) {
    try {
        console.log(`🔧 Getting appointment details for: ${appointmentId}`);
        const response = await makeAuthenticatedRequest(`/admin/appointments/${appointmentId}`);
        
        if (response && response.ok) {
            const data = await response.json();
            return data;
        } else {
            console.error('❌ Failed to get appointment details');
            return null;
        }
    } catch (error) {
        console.error('❌ Error getting appointment details:', error);
        return null;
    }
}

/**
 * Update appointment
 */
async function updateAppointment(appointmentId, updateData) {
    try {
        console.log(`🔧 Updating appointment ${appointmentId}...`);
        const response = await makeAuthenticatedRequest(`/admin/appointments/${appointmentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (response && response.ok) {
            showSuccessToast('Appointment updated successfully!');
            loadAppointments(); // Refresh appointments
            return true;
        } else {
            const errorData = await response.json();
            alert(`Failed to update appointment: ${errorData.message || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Error updating appointment:', error);
        alert('Error updating appointment. Please try again.');
        return false;
    }
}

// =======================
// SERVICE MANAGEMENT
// =======================

/**
 * Load services
 */
async function loadServices() {
    try {
        console.log('🔧 Loading services...');
        const response = await makeAuthenticatedRequest('/admin/services');
        
        if (response && response.ok) {
            const data = await response.json();
            displayServices(data);
            return data;
        } else {
            showError('services-container', 'Failed to load services');
        }
    } catch (error) {
        console.error('❌ Error loading services:', error);
        showError('services-container', 'Error loading services');
    }
}

// =======================
// PAYMENT MANAGEMENT
// =======================

/**
 * Load payments
 */
async function loadPayments() {
    try {
        console.log('🔧 Loading payments...');
        const response = await makeAuthenticatedRequest('/admin/payments');
        
        if (response && response.ok) {
            const data = await response.json();
            displayPayments(data);
            return data;
        } else {
            showError('payments-container', 'Failed to load payments');
        }
    } catch (error) {
        console.error('❌ Error loading payments:', error);
        showError('payments-container', 'Error loading payments');
    }
}

/**
 * Get payment details
 */
async function getPaymentDetails(paymentId) {
    try {
        console.log(`🔧 Getting payment details for: ${paymentId}`);
        const response = await makeAuthenticatedRequest(`/admin/payments/${paymentId}`);
        
        if (response && response.ok) {
            const data = await response.json();
            return data;
        } else {
            console.error('❌ Failed to get payment details');
            return null;
        }
    } catch (error) {
        console.error('❌ Error getting payment details:', error);
        return null;
    }
}

// =======================
// USER DETAILS & MANAGEMENT
// =======================

/**
 * Get user details
 */
async function getUserDetails(userId) {
    try {
        console.log(`🔧 Getting user details for: ${userId}`);
        const response = await makeAuthenticatedRequest(`/admin/users/${userId}`);
        
        if (response && response.ok) {
            const data = await response.json();
            return data;
        } else {
            console.error('❌ Failed to get user details');
            return null;
        }
    } catch (error) {
        console.error('❌ Error getting user details:', error);
        return null;
    }
}

/**
 * Update user
 */
async function updateUser(userId, updateData) {
    try {
        console.log(`🔧 Updating user ${userId}...`);
        const response = await makeAuthenticatedRequest(`/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (response && response.ok) {
            showSuccessToast('User updated successfully!');
            loadAllUsers(); // Refresh users
            return true;
        } else {
            const errorData = await response.json();
            alert(`Failed to update user: ${errorData.message || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Error updating user:', error);
        alert('Error updating user. Please try again.');
        return false;
    }
}

/**
 * Delete user
 */
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }
    
    try {
        console.log(`🔧 Deleting user ${userId}...`);
        const response = await makeAuthenticatedRequest(`/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        if (response && response.ok) {
            showSuccessToast('User deleted successfully!');
            loadAllUsers(); // Refresh users
        } else {
            const errorData = await response.json();
            alert(`Failed to delete user: ${errorData.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('❌ Error deleting user:', error);
        alert('Error deleting user. Please try again.');
    }
}

// =======================
// TECHNICIAN DETAILS & MANAGEMENT
// =======================

/**
 * Get technician details
 */
async function getTechnicianDetails(technicianId) {
    try {
        console.log(`🔧 Getting technician details for: ${technicianId}`);
        const response = await makeAuthenticatedRequest(`/admin/technicians/${technicianId}`);
        
        if (response && response.ok) {
            const data = await response.json();
            return data;
        } else {
            console.error('❌ Failed to get technician details');
            return null;
        }
    } catch (error) {
        console.error('❌ Error getting technician details:', error);
        return null;
    }
}

/**
 * Update technician
 */
async function updateTechnician(technicianId, updateData) {
    try {
        console.log(`🔧 Updating technician ${technicianId}...`);
        const response = await makeAuthenticatedRequest(`/admin/technicians/${technicianId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (response && response.ok) {
            showSuccessToast('Technician updated successfully!');
            loadAllTechnicians(); // Refresh technicians
            return true;
        } else {
            const errorData = await response.json();
            alert(`Failed to update technician: ${errorData.message || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Error updating technician:', error);
        alert('Error updating technician. Please try again.');
        return false;
    }
}

/**
 * Get appointment analytics
 */
async function getAppointmentAnalytics(period = '30d') {
    try {
        console.log(`🔧 Getting appointment analytics for period: ${period}`);
        const response = await makeAuthenticatedRequest(`/admin/analytics/appointments?period=${period}`);
        
        if (response && response.ok) {
            const data = await response.json();
            return data;
        } else {
            console.error('❌ Failed to load appointment analytics');
            return null;
        }
    } catch (error) {
        console.error('❌ Error loading appointment analytics:', error);
        return null;
    }
}

/**
 * Load legacy dashboard stats
 */
async function loadLegacyStats() {
    try {
        console.log('🔧 Loading legacy dashboard stats...');
        const response = await makeAuthenticatedRequest('/admin/dashboard/stats');
        
        if (response && response.ok) {
            const data = await response.json();
            return data;
        } else {
            console.error('❌ Failed to load legacy stats');
            return null;
        }
    } catch (error) {
        console.error('❌ Error loading legacy stats:', error);
        return null;
    }
}

/**
 * Show KYC status modal
 */
function showKycStatusModal(kycData) {
    const modalHtml = `
        <div class="modal fade" id="kycStatusModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">KYC Status Details</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6>Current Status</h6>
                                <p><span class="badge bg-${kycData.verificationStatus === 'VERIFIED' ? 'success' : kycData.verificationStatus === 'REJECTED' ? 'danger' : 'warning'}">${kycData.verificationStatus}</span></p>
                            </div>
                            <div class="col-md-6">
                                <h6>Firebase KYC</h6>
                                <p><span class="badge bg-${kycData.firebaseKycStatus === 'FIREBASE_VERIFIED' ? 'success' : kycData.firebaseKycStatus === 'FIREBASE_REJECTED' ? 'danger' : 'secondary'}">${kycData.firebaseKycStatus || 'PENDING'}</span></p>
                            </div>
                        </div>
                        <hr>
                        <div class="row">
                            <div class="col-12">
                                <h6>Documents</h6>
                                ${kycData.documents ? `<p>${JSON.stringify(kycData.documents, null, 2)}</p>` : '<p>No documents uploaded</p>'}
                            </div>
                        </div>
                        ${kycData.adminNotes ? `
                            <hr>
                            <div class="row">
                                <div class="col-12">
                                    <h6>Admin Notes</h6>
                                    <p>${kycData.adminNotes}</p>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to DOM and show
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('kycStatusModal'));
    modal.show();
    
    // Clean up when closed
    document.getElementById('kycStatusModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
}

/**
 * Enhanced load dashboard data with all components
 */
async function loadCompleteDashboard() {
    console.log('🔧 Loading complete dashboard...');
    
    // Load all dashboard components
    await Promise.all([
        loadDashboardStatistics(),
        loadRecentSubmissions(),
        loadPendingReviews(),
        loadAdminOverview(),
        checkSystemHealth(),
        getAnalyticsSummary(),
        loadServiceCategories()
    ]);
}

// Update the existing loadDashboardData function to use the complete version
window.loadDashboardData = loadCompleteDashboard;

// =======================
// ADDITIONAL DISPLAY FUNCTIONS
// =======================

/**
 * Display settings
 */
function displaySettings(data) {
    const container = document.getElementById('settings-container');
    if (!container) return;
    
    const settings = data.settings || data || {};
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h5 class="mb-0">System Settings</h5>
            </div>
            <div class="card-body">
                <form id="settings-form" onsubmit="handleSettingsSubmit(event)">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="app-name" class="form-label">Application Name</label>
                                <input type="text" class="form-control" id="app-name" value="${settings.appName || 'Techi-Pro Konnect'}">
                            </div>
                            <div class="mb-3">
                                <label for="support-email" class="form-label">Support Email</label>
                                <input type="email" class="form-control" id="support-email" value="${settings.supportEmail || ''}">
                            </div>
                            <div class="mb-3">
                                <label for="max-technicians" class="form-label">Max Technicians per Category</label>
                                <input type="number" class="form-control" id="max-technicians" value="${settings.maxTechniciansPerCategory || 100}">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="kyc-auto-approve" class="form-label">KYC Auto-Approval</label>
                                <select class="form-select" id="kyc-auto-approve">
                                    <option value="false" ${!settings.kycAutoApprove ? 'selected' : ''}>Manual Review Required</option>
                                    <option value="true" ${settings.kycAutoApprove ? 'selected' : ''}>Auto-Approve Firebase Verified</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label for="maintenance-mode" class="form-label">Maintenance Mode</label>
                                <select class="form-select" id="maintenance-mode">
                                    <option value="false" ${!settings.maintenanceMode ? 'selected' : ''}>Disabled</option>
                                    <option value="true" ${settings.maintenanceMode ? 'selected' : ''}>Enabled</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label for="booking-advance-days" class="form-label">Booking Advance Days</label>
                                <input type="number" class="form-control" id="booking-advance-days" value="${settings.bookingAdvanceDays || 7}">
                            </div>
                        </div>
                    </div>
                    <hr>
                    <div class="d-flex justify-content-end">
                        <button type="button" class="btn btn-secondary me-2" onclick="loadSettings()">Reset</button>
                        <button type="submit" class="btn btn-primary">Save Settings</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

/**
 * Display bookings
 */
function displayAppointments(data) {
    const container = document.getElementById('appointments-container');
    if (!container) return;
    
    const appointments = data.appointments || data.items || [];
    const total = data.total || appointments.length;
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">All Appointments (${total})</h5>
                <div class="btn-group" role="group">
                    <button type="button" class="btn btn-outline-success btn-sm" onclick="filterAppointments('completed')">Completed</button>
                    <button type="button" class="btn btn-outline-warning btn-sm" onclick="filterAppointments('scheduled')">Scheduled</button>
                    <button type="button" class="btn btn-outline-info btn-sm" onclick="filterAppointments('in_progress')">In Progress</button>
                    <button type="button" class="btn btn-outline-danger btn-sm" onclick="filterAppointments('cancelled')">Cancelled</button>
                </div>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Appointment ID</th>
                                <th>Customer</th>
                                <th>Technician</th>
                                <th>Service</th>
                                <th>Date & Time</th>
                                <th>Status</th>
                                <th>Amount</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${appointments.map(appointment => `
                                <tr>
                                    <td>#${appointment.id}</td>
                                    <td>${appointment.customer?.name || appointment.user?.username || 'N/A'}</td>
                                    <td>${appointment.technician?.name || appointment.technician?.username || 'Unassigned'}</td>
                                    <td>${appointment.service?.name || 'N/A'}</td>
                                    <td>${new Date(appointment.scheduledAt).toLocaleString()}</td>
                                    <td><span class="badge bg-${getAppointmentStatusColor(appointment.status)}">${appointment.status}</span></td>
                                    <td>$${appointment.amount || '0'}</td>
                                    <td>
                                        <button class="btn btn-sm btn-outline-primary" onclick="viewAppointmentDetails('${appointment.id}')">
                                            <i class="bi-eye"></i>
                                        </button>
                                        <button class="btn btn-sm btn-outline-warning" onclick="editAppointment('${appointment.id}')">
                                            <i class="bi-pencil"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

/**
 * Display services
 */
function displayServices(data) {
    const container = document.getElementById('services-container');
    if (!container) return;
    
    const services = data.services || data.items || [];
    const total = data.total || services.length;
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">All Services (${total})</h5>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Service Name</th>
                                <th>Category</th>
                                <th>Description</th>
                                <th>Price Range</th>
                                <th>Active</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${services.map(service => `
                                <tr>
                                    <td>${service.name}</td>
                                    <td>${service.category?.name || 'N/A'}</td>
                                    <td>${service.description || 'N/A'}</td>
                                    <td>$${service.minPrice || '0'} - $${service.maxPrice || '0'}</td>
                                    <td><span class="badge bg-${service.isActive ? 'success' : 'secondary'}">${service.isActive ? 'Active' : 'Inactive'}</span></td>
                                    <td>${new Date(service.createdAt).toLocaleDateString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

/**
 * Display payments
 */
function displayPayments(data) {
    const container = document.getElementById('payments-container');
    if (!container) return;
    
    const payments = data.payments || data.items || [];
    const total = data.total || payments.length;
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">All Payments (${total})</h5>
                <div class="btn-group" role="group">
                    <button type="button" class="btn btn-outline-success btn-sm" onclick="filterPayments('completed')">Completed</button>
                    <button type="button" class="btn btn-outline-warning btn-sm" onclick="filterPayments('pending')">Pending</button>
                    <button type="button" class="btn btn-outline-danger btn-sm" onclick="filterPayments('failed')">Failed</button>
                </div>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Payment ID</th>
                                <th>Appointment</th>
                                <th>Customer</th>
                                <th>Amount</th>
                                <th>Payment Method</th>
                                <th>Status</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${payments.map(payment => `
                                <tr>
                                    <td>#${payment.id}</td>
                                    <td>#${payment.appointmentId || 'N/A'}</td>
                                    <td>${payment.customer?.name || payment.user?.username || 'N/A'}</td>
                                    <td>$${payment.amount}</td>
                                    <td>${payment.paymentMethod || 'N/A'}</td>
                                    <td><span class="badge bg-${getPaymentStatusColor(payment.status)}">${payment.status}</span></td>
                                    <td>${new Date(payment.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <button class="btn btn-sm btn-outline-primary" onclick="viewPaymentDetails('${payment.id}')">
                                            <i class="bi-eye"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// =======================
// HELPER FUNCTIONS FOR NEW FEATURES
// =======================

/**
 * Handle settings form submission
 */
function handleSettingsSubmit(event) {
    event.preventDefault();
    
    const settingsData = {
        appName: document.getElementById('app-name').value,
        supportEmail: document.getElementById('support-email').value,
        maxTechniciansPerCategory: parseInt(document.getElementById('max-technicians').value),
        kycAutoApprove: document.getElementById('kyc-auto-approve').value === 'true',
        maintenanceMode: document.getElementById('maintenance-mode').value === 'true',
        bookingAdvanceDays: parseInt(document.getElementById('booking-advance-days').value)
    };
    
    updateSettings(settingsData);
}

/**
 * Get booking status color
 */
function getAppointmentStatusColor(status) {
    switch (status?.toLowerCase()) {
        case 'completed': return 'success';
        case 'scheduled': return 'primary';
        case 'in_progress': return 'info';
        case 'cancelled': return 'danger';
        case 'pending': return 'warning';
        default: return 'secondary';
    }
}

/**
 * Get payment status color
 */
function getPaymentStatusColor(status) {
    switch (status?.toLowerCase()) {
        case 'completed': case 'success': return 'success';
        case 'pending': return 'warning';
        case 'failed': case 'declined': return 'danger';
        case 'processing': return 'info';
        default: return 'secondary';
    }
}

/**
 * Filter appointments by status
 */
function filterAppointments(status) {
    console.log(`Filtering appointments by status: ${status}`);
    loadAppointments(); // For now, just reload all appointments
}

/**
 * Filter payments by status
 */
function filterPayments(status) {
    console.log(`Filtering payments by status: ${status}`);
    loadPayments(); // For now, just reload all payments
}

/**
 * View appointment details
 */
async function viewAppointmentDetails(appointmentId) {
    try {
        console.log(`Viewing appointment details for: ${appointmentId}`);
        const appointmentData = await getAppointmentDetails(appointmentId);
        if (appointmentData) {
            showAppointmentDetailsModal(appointmentData);
        } else {
            alert('Failed to load appointment details');
        }
    } catch (error) {
        console.error('Error viewing appointment details:', error);
        alert('Error loading appointment details');
    }
}

/**
 * Edit appointment
 */
async function editAppointment(appointmentId) {
    try {
        console.log(`Editing appointment: ${appointmentId}`);
        const appointmentData = await getAppointmentDetails(appointmentId);
        if (appointmentData) {
            showEditAppointmentModal(appointmentData);
        } else {
            alert('Failed to load appointment details for editing');
        }
    } catch (error) {
        console.error('Error loading appointment for edit:', error);
        alert('Error loading appointment details');
    }
}

/**
 * View payment details
 */
async function viewPaymentDetails(paymentId) {
    try {
        console.log(`Viewing payment details for: ${paymentId}`);
        const paymentData = await getPaymentDetails(paymentId);
        if (paymentData) {
            showPaymentDetailsModal(paymentData);
        } else {
            alert('Failed to load payment details');
        }
    } catch (error) {
        console.error('Error viewing payment details:', error);
        alert('Error loading payment details');
    }
}

/**
 * Show user details modal
 */
function showUserDetailsModal(userData) {
    // This would show a modal with detailed user information
    alert(`User Details for ${userData.username}: ${JSON.stringify(userData, null, 2)}`);
}

/**
 * Show technician details modal
 */
function showTechnicianDetailsModal(technicianData) {
    // This would show a modal with detailed technician information
    alert(`Technician Details for ${technicianData.username}: ${JSON.stringify(technicianData, null, 2)}`);
}

/**
 * Show appointment details modal
 */
function showAppointmentDetailsModal(appointmentData) {
    // This would show a modal with detailed appointment information
    alert(`Appointment Details for #${appointmentData.id}: ${JSON.stringify(appointmentData, null, 2)}`);
}

/**
 * Show edit appointment modal
 */
function showEditAppointmentModal(appointmentData) {
    // This would show a modal for editing appointment
    alert(`Edit Appointment #${appointmentData.id} - Modal coming soon!`);
}

/**
 * Show payment details modal
 */
function showPaymentDetailsModal(paymentData) {
    // This would show a modal with detailed payment information
    alert(`Payment Details for #${paymentData.id}: ${JSON.stringify(paymentData, null, 2)}`);
}

/**
 * Show services page
 */
function showServices() {
    updateActiveNav('Services');
    hideAllContent();
    document.getElementById('services-content').style.display = 'block';
    loadServices();
}

/**
 * Show payments page
 */
function showPayments() {
    updateActiveNav('Payments');
    hideAllContent();
    document.getElementById('payments-content').style.display = 'block';
    loadPayments();
}

/**
 * Edit user
 */
async function editUser(userId) {
    try {
        console.log(`Editing user: ${userId}`);
        const userData = await getUserDetails(userId);
        if (userData) {
            showEditUserModal(userData);
        } else {
            alert('Failed to load user details for editing');
        }
    } catch (error) {
        console.error('Error loading user for edit:', error);
        alert('Error loading user details');
    }
}

/**
 * Edit technician
 */
async function editTechnician(technicianId) {
    try {
        console.log(`Editing technician: ${technicianId}`);
        const technicianData = await getTechnicianDetails(technicianId);
        if (technicianData) {
            showEditTechnicianModal(technicianData);
        } else {
            alert('Failed to load technician details for editing');
        }
    } catch (error) {
        console.error('Error loading technician for edit:', error);
        alert('Error loading technician details');
    }
}

/**
 * Show edit user modal
 */
function showEditUserModal(userData) {
    // This would show a modal for editing user
    alert(`Edit User ${userData.username} - Modal coming soon!`);
}

/**
 * Show edit technician modal
 */
function showEditTechnicianModal(technicianData) {
    // This would show a modal for editing technician
    alert(`Edit Technician ${technicianData.username} - Modal coming soon!`);
}

/**
 * Filter bookings by status
 */
function filterBookings(status) {
    // Implementation for filtering bookings
    console.log(`Filtering bookings by status: ${status}`);
    loadBookings(); // For now, just reload all bookings
}

/**
 * View booking details
 */
function viewBookingDetails(bookingId) {
    console.log(`Viewing booking details for: ${bookingId}`);
    // Implementation for viewing booking details
    alert(`Booking details for ${bookingId} - Coming soon!`);
}

/**
 * Enhanced user search functionality
 */
function setupUserSearch() {
    const searchInput = document.getElementById('user-search');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const searchTerm = this.value.trim();
                if (searchTerm.length >= 2) {
                    loadAllUsers(1, 10, { search: searchTerm });
                } else if (searchTerm.length === 0) {
                    loadAllUsers();
                }
            }, 500);
        });
    }
}

/**
 * Enhanced technician search functionality
 */
function setupTechnicianSearch() {
    const searchInput = document.getElementById('technician-search');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const searchTerm = this.value.trim();
                if (searchTerm.length >= 2) {
                    loadAllTechnicians(1, 10, null, searchTerm);
                } else if (searchTerm.length === 0) {
                    loadAllTechnicians();
                }
            }, 500);
        });
    }
}

// Initialize search functionality when DOM is ready
$(document).ready(function() {
    setupUserSearch();
    setupTechnicianSearch();
});
