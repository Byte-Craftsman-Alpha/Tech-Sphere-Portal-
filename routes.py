from flask import render_template, request, redirect, url_for, flash
from flask_login import login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

from extensions import db
from models import User, Event, Announcement, ForumPost, ForumCategory, Notification

# Get app instance
from flask import current_app as app

@app.template_global()
def utcnow():
    return datetime.utcnow()

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return render_template('landing.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        user = User.query.filter_by(email=email).first()
        
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            next_page = request.args.get('next')
            return redirect(next_page) if next_page else redirect(url_for('dashboard'))
        else:
            flash('Invalid email or password', 'error')
    
    return render_template('auth/login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        full_name = request.form['full_name']
        
        if User.query.filter_by(email=email).first():
            flash('Email already registered', 'error')
            return render_template('auth/register.html')
        
        if User.query.filter_by(username=username).first():
            flash('Username already taken', 'error')
            return render_template('auth/register.html')
        
        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password),
            full_name=full_name
        )
        db.session.add(user)
        db.session.commit()
        
        login_user(user)
        flash('Registration successful!', 'success')
        return redirect(url_for('dashboard'))
    
    return render_template('auth/register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/dashboard')
@login_required
def dashboard():
    # Get upcoming events
    upcoming_events = Event.query.filter(
        Event.start_date > datetime.utcnow(),
        Event.is_active == True
    ).order_by(Event.start_date).limit(5).all()
    
    # Get recent announcements
    recent_announcements = Announcement.query.order_by(
        Announcement.created_at.desc()
    ).limit(5).all()
    
    # Get trending forum posts
    trending_posts = ForumPost.query.order_by(
        ForumPost.views.desc()
    ).limit(5).all()
    
    # Get user's notifications
    notifications = Notification.query.filter_by(
        user_id=current_user.id,
        is_read=False
    ).order_by(Notification.created_at.desc()).limit(5).all()
    
    return render_template('dashboard.html', 
                         upcoming_events=upcoming_events,
                         recent_announcements=recent_announcements,
                         trending_posts=trending_posts,
                         notifications=notifications)

@app.route('/events')
@login_required
def events():
    event_type = request.args.get('type', 'all')
    
    query = Event.query.filter_by(is_active=True)
    if event_type != 'all':
        query = query.filter_by(event_type=event_type)
    
    events = query.order_by(Event.start_date).all()
    
    # Categorize events
    upcoming = [e for e in events if e.start_date > datetime.utcnow()]
    ongoing = [e for e in events if e.start_date <= datetime.utcnow() <= e.end_date]
    past = [e for e in events if e.end_date < datetime.utcnow()]
    
    return render_template('events/list.html', 
                         upcoming=upcoming, 
                         ongoing=ongoing, 
                         past=past,
                         current_type=event_type)

@app.route('/events/<int:event_id>')
@login_required
def event_detail(event_id):
    from models import EventTeamRegistration, EventRegistration, EventTeamMember, EventTeamInvitation
    
    event = Event.query.get_or_404(event_id)
    
    # Count all registrations for this event
    individual_count = EventRegistration.query.filter_by(event_id=event_id).count()
    team_count = EventTeamRegistration.query.filter_by(event_id=event_id).count()
    registration_count = individual_count + team_count
    
    is_registered = False
    team_registration = None
    user_team_membership = None
    pending_invitations = []
    
    # Check for individual registration
    individual_reg = EventRegistration.query.filter_by(
        user_id=current_user.id, 
        event_id=event_id
    ).first()
    
    # Check for team registration (where user is team leader)
    team_reg = EventTeamRegistration.query.filter_by(
        team_leader_id=current_user.id,
        event_id=event_id
    ).first()
    
    # Check if user is a member of any team for this event
    team_membership = db.session.query(EventTeamMember).join(
        EventTeamRegistration
    ).filter(
        EventTeamMember.user_id == current_user.id,
        EventTeamRegistration.event_id == event_id
    ).first()
    
    # Check for pending invitations
    pending_invitations = EventTeamInvitation.query.filter_by(
        invited_user_id=current_user.id,
        status='pending'
    ).join(EventTeamRegistration).filter(
        EventTeamRegistration.event_id == event_id
    ).all()
    
    if individual_reg:
        is_registered = True
    if team_reg:
        team_registration = team_reg
    if team_membership:
        user_team_membership = team_membership
    
    return render_template('events/detail.html', 
                         event=event, 
                         is_registered=is_registered,
                         team_registration=team_registration,
                         user_team_membership=user_team_membership,
                         pending_invitations=pending_invitations,
                         registration_count=registration_count)

# View team invitation
@app.route('/events/<int:event_id>/invitations/<int:invitation_id>')
@login_required
def view_team_invitation(event_id, invitation_id):
    from models import EventTeamInvitation
    
    invitation = EventTeamInvitation.query.get_or_404(invitation_id)
    
    # Check if user is the invited person
    if invitation.invited_user_id != current_user.id:
        flash('Access denied.', 'error')
        return redirect(url_for('dashboard'))
    
    # Check if invitation is still valid
    if invitation.status != 'pending' or datetime.utcnow() > invitation.expires_at:
        flash('This invitation has expired or already been responded to.', 'error')
        return redirect(url_for('dashboard'))
    
    return render_template('events/team_invitation.html', 
                         invitation=invitation, 
                         event=invitation.team_registration.event)

# Accept team invitation
@app.route('/events/<int:event_id>/invitations/<int:invitation_id>/accept', methods=['POST'])
@login_required
def accept_team_invitation(event_id, invitation_id):
    from models import EventTeamInvitation, EventTeamMember
    
    invitation = EventTeamInvitation.query.get_or_404(invitation_id)
    
    if invitation.invited_user_id != current_user.id:
        flash('Access denied.', 'error')
        return redirect(url_for('dashboard'))
    
    if invitation.status != 'pending':
        flash('This invitation has already been responded to.', 'error')
        return redirect(url_for('event_detail', event_id=event_id))
    
    # Check if user is already in another team for this event
    existing_membership = db.session.query(EventTeamMember).join(
        EventTeamRegistration
    ).filter(
        EventTeamMember.user_id == current_user.id,
        EventTeamRegistration.event_id == event_id
    ).first()
    
    if existing_membership:
        flash('You are already registered for this event in another team!', 'error')
        return redirect(url_for('event_detail', event_id=event_id))
    
    # Accept invitation - add user to team
    team_member = EventTeamMember(
        team_registration_id=invitation.team_registration_id,
        user_id=current_user.id,
        role=invitation.role,
        skills=invitation.skills
    )
    db.session.add(team_member)
    
    # Update invitation status
    invitation.status = 'accepted'
    invitation.responded_at = datetime.utcnow()
    
    db.session.commit()
    
    flash(f'Successfully joined team "{invitation.team_registration.team_name}"!', 'success')
    return redirect(url_for('event_detail', event_id=event_id))

# Reject team invitation
@app.route('/events/<int:event_id>/invitations/<int:invitation_id>/reject', methods=['POST'])
@login_required
def reject_team_invitation(event_id, invitation_id):
    from models import EventTeamInvitation
    
    invitation = EventTeamInvitation.query.get_or_404(invitation_id)
    
    if invitation.invited_user_id != current_user.id:
        flash('Access denied.', 'error')
        return redirect(url_for('dashboard'))
    
    if invitation.status != 'pending':
        flash('This invitation has already been responded to.', 'error')
        return redirect(url_for('event_detail', event_id=event_id))
    
    # Reject invitation
    invitation.status = 'rejected'
    invitation.responded_at = datetime.utcnow()
    
    db.session.commit()
    
    flash('Team invitation declined.', 'info')
    return redirect(url_for('event_detail', event_id=event_id))

# Quit team (for members only)
@app.route('/events/<int:event_id>/quit-team', methods=['POST'])
@login_required
def quit_team(event_id):
    from models import EventTeamMember, EventTeamRegistration
    
    # Find user's membership in this event
    membership = db.session.query(EventTeamMember).join(
        EventTeamRegistration
    ).filter(
        EventTeamMember.user_id == current_user.id,
        EventTeamRegistration.event_id == event_id,
        EventTeamMember.role != 'leader'  # Leaders can't quit, they must delete the team
    ).first()
    
    if not membership:
        flash('You are not a member of any team for this event, or you are a team leader.', 'error')
        return redirect(url_for('event_detail', event_id=event_id))
    
    team_name = membership.team_registration.team_name
    db.session.delete(membership)
    db.session.commit()
    
    flash(f'You have left team "{team_name}".', 'info')
    return redirect(url_for('event_detail', event_id=event_id))

@app.route('/forum')
@login_required
def forum():
    # Calculate real active members (users who posted in last 30 days)
    from datetime import datetime, timedelta
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    active_members = db.session.query(User.id).join(ForumPost).filter(
        ForumPost.created_at >= thirty_days_ago
    ).distinct().count()
    
    # Add back the missing variables
    categories = ForumCategory.query.all()
    recent_posts = ForumPost.query.order_by(ForumPost.created_at.desc()).limit(10).all()
    
    return render_template('forum/index.html', 
                         categories=categories,
                         recent_posts=recent_posts,
                         active_members=active_members)

@app.route('/forum/post/<int:post_id>')
@login_required
def forum_post(post_id):
    from models import ForumComment
    post = ForumPost.query.get_or_404(post_id)
    
    # Increment view count
    post.views += 1
    db.session.commit()
    
    # Get only top-level comments (replies will be loaded via relationships)
    comments = ForumComment.query.filter_by(post_id=post_id, parent_id=None).order_by(ForumComment.created_at.asc()).all()
    
    return render_template('forum/post.html', post=post, comments=comments)

# Add comment to forum post
@app.route('/forum/post/<int:post_id>/comment', methods=['POST'])
@login_required
def add_forum_comment(post_id):
    from models import ForumComment
    post = ForumPost.query.get_or_404(post_id)
    
    content = request.form.get('content')
    if content:
        comment = ForumComment(
            content=content,
            post_id=post_id,
            author_id=current_user.id
        )
        db.session.add(comment)
        db.session.commit()
        flash('Comment added successfully!', 'success')
    
    return redirect(url_for('forum_post', post_id=post_id))

# Delete forum comment
@app.route('/forum/comment/<int:comment_id>/delete', methods=['POST'])
@login_required
def delete_forum_comment(comment_id):
    from models import ForumComment
    comment = ForumComment.query.get_or_404(comment_id)
    
    # Check permissions: admin or comment author
    if not (current_user.is_admin or comment.author_id == current_user.id):
        flash('Access denied. You can only delete your own comments.', 'error')
        return redirect(url_for('forum_post', post_id=comment.post_id))
    
    post_id = comment.post_id
    db.session.delete(comment)
    db.session.commit()
    flash('Comment deleted successfully!', 'success')
    
    return redirect(url_for('forum_post', post_id=post_id))

# Vote on forum comment
@app.route('/api/forum/comment/<int:comment_id>/vote', methods=['POST'])
@login_required
def vote_forum_comment(comment_id):
    from flask import jsonify
    from models import ForumComment, ForumCommentVote
    
    data = request.get_json()
    vote_type = data.get('vote_type')  # 'upvote' or 'downvote'
    
    comment = ForumComment.query.get_or_404(comment_id)
    
    # Check if user already voted
    existing_vote = ForumCommentVote.query.filter_by(
        user_id=current_user.id,
        comment_id=comment_id
    ).first()
    
    if existing_vote:
        if existing_vote.vote_type == vote_type:
            # Remove vote
            db.session.delete(existing_vote)
            if vote_type == 'upvote':
                comment.upvotes -= 1
            else:
                comment.downvotes -= 1
        else:
            # Change vote
            existing_vote.vote_type = vote_type
            if vote_type == 'upvote':
                comment.upvotes += 1
                comment.downvotes -= 1
            else:
                comment.downvotes += 1
                comment.upvotes -= 1
    else:
        # New vote
        vote = ForumCommentVote(
            user_id=current_user.id,
            comment_id=comment_id,
            vote_type=vote_type
        )
        db.session.add(vote)
        if vote_type == 'upvote':
            comment.upvotes += 1
        else:
            comment.downvotes += 1
    
    db.session.commit()
    
    return jsonify({
        'upvotes': comment.upvotes,
        'downvotes': comment.downvotes
    })

# Reply to forum comment
@app.route('/forum/comment/<int:comment_id>/reply', methods=['POST'])
@login_required
def reply_forum_comment(comment_id):
    from models import ForumComment
    parent_comment = ForumComment.query.get_or_404(comment_id)
    
    content = request.form.get('content')
    if content:
        reply = ForumComment(
            content=content,
            post_id=parent_comment.post_id,
            author_id=current_user.id,
            parent_id=comment_id
        )
        db.session.add(reply)
        db.session.commit()
        flash('Reply added successfully!', 'success')
    
    return redirect(url_for('forum_post', post_id=parent_comment.post_id))

@app.route('/forum/new-post', methods=['GET', 'POST'])
@login_required
def new_forum_post():
    if request.method == 'POST':
        post = ForumPost(
            title=request.form['title'],
            content=request.form['content'],
            tags=request.form.get('tags', ''),
            author_id=current_user.id,
            category_id=request.form['category_id']
        )
        
        db.session.add(post)
        db.session.commit()
        
        flash('Post created successfully!', 'success')
        return redirect(url_for('forum_post', post_id=post.id))
    
    categories = ForumCategory.query.all()
    return render_template('forum/new_post.html', categories=categories)

@app.route('/announcements')
@login_required
def announcements():
    category = request.args.get('category', 'all')
    
    query = Announcement.query
    if category != 'all':
        query = query.filter_by(category=category)
    
    announcements = query.order_by(
        Announcement.is_pinned.desc(),
        Announcement.created_at.desc()
    ).all()
    
    categories = db.session.query(Announcement.category).distinct().all()
    categories = [cat[0] for cat in categories if cat[0]]
    
    return render_template('announcements/list.html', 
                         announcements=announcements,
                         categories=categories,
                         current_category=category)

@app.route('/announcements/<int:announcement_id>')
@login_required
def announcement_detail(announcement_id):
    announcement = Announcement.query.get_or_404(announcement_id)
    return render_template('announcements/detail.html', announcement=announcement)

@app.route('/teams')
@login_required
def teams():
    from models import Team, TeamMember, TeamJoinRequest, User

    teams_data = []
    teams = Team.query.filter_by(is_open=True).order_by(Team.created_at.desc()).all()

    for team in teams:
        leader = User.query.get(team.leader_id)
        member_count = TeamMember.query.filter_by(team_id=team.id).count()
        is_member = TeamMember.query.filter_by(team_id=team.id, user_id=current_user.id).first()
        pending_request = TeamJoinRequest.query.filter_by(team_id=team.id, user_id=current_user.id, status='pending').first()
        
        teams_data.append({
            'team': team, 'leader': leader, 'member_count': member_count,
            'is_member': is_member, 'pending_request': pending_request
        })

    return render_template('teams/list.html', teams=teams_data)

@app.route('/profile')
@login_required
def profile():
    user_achievements = []
    user_posts = ForumPost.query.filter_by(author_id=current_user.id).count()
    user_events = 0
    
    return render_template('profile/view.html', 
                         user_achievements=user_achievements,
                         user_posts=user_posts,
                         user_events=user_events)

@app.route('/admin')
@login_required
def admin_dashboard():
    if not current_user.is_admin:
        flash('Access denied', 'error')
        return redirect(url_for('dashboard'))
    
    stats = {
        'users': User.query.count(),
        'events': Event.query.count(),
        'posts': ForumPost.query.count(),
        'announcements': Announcement.query.count()
    }
    
    return render_template('admin/dashboard.html', stats=stats)

@app.route('/admin/events/create', methods=['GET', 'POST'])
@login_required
def admin_create_event():
    if not current_user.is_admin:
        flash('Access denied', 'error')
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        event = Event(
        title=request.form['title'],
        description=request.form['description'],
        event_type=request.form['event_type'],
        start_date=datetime.strptime(request.form['start_date'], '%Y-%m-%dT%H:%M'),
        end_date=datetime.strptime(request.form['end_date'], '%Y-%m-%dT%H:%M'),
        venue=request.form.get('venue'),
        virtual_link=request.form.get('virtual_link'),
        max_participants=int(request.form['max_participants']) if request.form.get('max_participants') else None,
        min_team_size=int(request.form.get('min_team_size', 1)),  # ADD THIS LINE
        max_team_size=int(request.form.get('max_team_size', 5)),  # ADD THIS LINE
        registration_deadline=datetime.strptime(request.form['registration_deadline'], '%Y-%m-%dT%H:%M') if request.form.get('registration_deadline') else None,
        rules=request.form.get('rules'),
        prizes=request.form.get('prizes'),
        creator_id=current_user.id
    )
        
        db.session.add(event)
        db.session.commit()
        
        flash('Event created successfully!', 'success')
        return redirect(url_for('admin_dashboard'))
    
    return render_template('admin/create_event.html')

@app.route('/admin/announcements/create', methods=['GET', 'POST'])
@login_required
def admin_create_announcement():
    if not current_user.is_admin:
        flash('Access denied', 'error')
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        announcement = Announcement(
            title=request.form['title'],
            content=request.form['content'],
            category=request.form['category'],
            priority=request.form.get('priority', 'normal'),
            is_pinned=bool(request.form.get('is_pinned')),
            author_id=current_user.id
        )
        
        db.session.add(announcement)
        db.session.commit()
        
        flash('Announcement created successfully!', 'success')
        return redirect(url_for('announcements'))
    
    return render_template('admin/create_announcement.html')

# Admin: View all registrations
@app.route('/admin/registrations')
@login_required
def admin_all_registrations():
    if not current_user.is_admin:
        flash('Access denied', 'error')
        return redirect(url_for('dashboard'))
    
    from models import EventTeamRegistration, EventRegistration
    
    event_id = request.args.get('event_id')
    
    if event_id:
        team_registrations = EventTeamRegistration.query.filter_by(event_id=event_id).join(Event).all()
        individual_registrations = EventRegistration.query.filter_by(event_id=event_id).join(Event).all()
    else:
        team_registrations = EventTeamRegistration.query.join(Event).all()
        individual_registrations = EventRegistration.query.join(Event).all()
    
    # Get all events for the filter dropdown
    all_events = Event.query.all()
    
    return render_template('admin/all_registrations.html', 
                         team_registrations=team_registrations,
                         individual_registrations=individual_registrations,
                         all_events=all_events)

@app.route('/teams/create', methods=['GET', 'POST'])
@login_required
def create_team():
    if request.method == 'POST':
        # Import Team model
        from models import Team, TeamMember
        
        # Create new team
        team = Team(
            name=request.form['name'],
            description=request.form.get('description', ''),
            leader_id=current_user.id,  # Use leader_id instead of creator_id
            max_members=int(request.form.get('max_members', 10)),
            is_open=True  # Use is_open instead of is_active
        )
        
        db.session.add(team)
        db.session.commit()  # Save the team first
        
        # Add creator as team member
        team_member = TeamMember(
            team_id=team.id,
            user_id=current_user.id,
            role='leader',
            joined_at=datetime.utcnow()
        )
        
        db.session.add(team_member)
        db.session.commit()
        
        flash('Team created successfully!', 'success')
        return redirect(url_for('teams'))
    
    # Get events for team creation form
    events = Event.query.filter(Event.start_date > datetime.utcnow()).all()
    return render_template('teams/create.html', events=events)

# Team detail page with join request functionality
@app.route('/teams/<int:team_id>')
@login_required
def team_detail(team_id):
    from models import Team, TeamMember, TeamJoinRequest, TeamMessage
    
    team = Team.query.get_or_404(team_id)
    
    # Check if user is a member
    is_member = TeamMember.query.filter_by(team_id=team_id, user_id=current_user.id).first()
    
    # Check if user has pending join request
    pending_request = TeamJoinRequest.query.filter_by(
        team_id=team_id, 
        user_id=current_user.id, 
        status='pending'
    ).first()
    
    # Get team members with their roles
    members = db.session.query(TeamMember, User).join(User).filter(TeamMember.team_id == team_id).all()
    
    # Get join requests (only for team leader)
    join_requests = []
    if is_member and is_member.role == 'leader':
        join_requests = db.session.query(TeamJoinRequest, User).join(
            User, TeamJoinRequest.user_id == User.id
        ).filter(
            TeamJoinRequest.team_id == team_id,
            TeamJoinRequest.status == 'pending'
        ).all()
    
    # Get team messages (only for team members)
    messages = []
    if is_member:
        messages = db.session.query(TeamMessage, User).join(
            User, TeamMessage.user_id == User.id
        ).filter(
            TeamMessage.team_id == team_id,
            TeamMessage.is_deleted == False
        ).order_by(TeamMessage.created_at.desc()).limit(50).all()

    return render_template('teams/detail.html', 
                     team=team, 
                     is_member=is_member,
                     pending_request=pending_request,
                     members=members,
                     join_requests=join_requests,
                     messages=messages)

# Join team request
@app.route('/teams/<int:team_id>/join', methods=['POST'])
@login_required
def join_team(team_id):
    from models import Team, TeamMember, TeamJoinRequest
    
    team = Team.query.get_or_404(team_id)
    
    # Check if already a member
    if TeamMember.query.filter_by(team_id=team_id, user_id=current_user.id).first():
        flash('You are already a member of this team!', 'info')
        return redirect(url_for('team_detail', team_id=team_id))
    
    # Check if already has pending request
    if TeamJoinRequest.query.filter_by(team_id=team_id, user_id=current_user.id, status='pending').first():
        flash('You already have a pending request for this team!', 'info')
        return redirect(url_for('team_detail', team_id=team_id))
    
    # Create join request
    join_request = TeamJoinRequest(
        team_id=team_id,
        user_id=current_user.id,
        message=request.form.get('message', '')
    )
    
    db.session.add(join_request)
    db.session.commit()
    
    flash('Join request sent successfully!', 'success')
    return redirect(url_for('team_detail', team_id=team_id))

# Approve/Reject join request
@app.route('/teams/<int:team_id>/requests/<int:request_id>/<action>', methods=['POST'])
@login_required
def handle_join_request(team_id, request_id, action):
    from models import Team, TeamMember, TeamJoinRequest
    
    team = Team.query.get_or_404(team_id)
    join_request = TeamJoinRequest.query.get_or_404(request_id)
    
    # Check if user is team leader
    member = TeamMember.query.filter_by(team_id=team_id, user_id=current_user.id).first()
    if not member or member.role != 'leader':
        flash('Access denied. Only team leaders can manage join requests.', 'error')
        return redirect(url_for('team_detail', team_id=team_id))
    
    if action == 'approve':
        # Add user to team
        team_member = TeamMember(
            team_id=team_id,
            user_id=join_request.user_id,
            role='member',
            joined_at=datetime.utcnow()
        )
        db.session.add(team_member)
        
        # Update request status
        join_request.status = 'approved'
        join_request.reviewed_at = datetime.utcnow()
        join_request.reviewed_by = current_user.id
        
        flash('Join request approved successfully!', 'success')
        
    elif action == 'reject':
        join_request.status = 'rejected'
        join_request.reviewed_at = datetime.utcnow()
        join_request.reviewed_by = current_user.id
        
        flash('Join request rejected.', 'info')
    
    db.session.commit()
    return redirect(url_for('team_detail', team_id=team_id))

@app.route('/events/<int:event_id>/register', methods=['POST'])
@login_required
def register_event(event_id):
    from models import EventRegistration
    event = Event.query.get_or_404(event_id)
    
    # Check if user already registered
    existing = EventRegistration.query.filter_by(user_id=current_user.id, event_id=event_id).first()
    if existing:
        flash('You are already registered for this event!', 'info')
        return redirect(url_for('event_detail', event_id=event_id))
    
    # Create registration
    registration = EventRegistration(
        user_id=current_user.id,
        event_id=event_id,
        team_name=request.form.get('team_name'),
        additional_info=request.form.get('additional_info')
    )
    db.session.add(registration)
    db.session.commit()
    
    flash('Successfully registered for the event!', 'success')
    return redirect(url_for('event_detail', event_id=event_id))

# Team registration for events
@app.route('/events/<int:event_id>/register-team', methods=['GET', 'POST'])
@login_required
def register_event_team(event_id):
    from models import Event, EventTeamRegistration, EventTeamMember, EventTeamInvitation
    from datetime import timedelta
    
    event = Event.query.get_or_404(event_id)
    
    # Check if registration deadline has passed
    if datetime.utcnow() > event.registration_deadline:
        flash('Registration deadline has passed!', 'error')
        return redirect(url_for('event_detail', event_id=event_id))
    
    # Check if user already registered or has pending invitation
    existing_registration = EventTeamRegistration.query.filter_by(
        event_id=event_id, team_leader_id=current_user.id
    ).first()
    
    if existing_registration:
        return redirect(url_for('edit_event_registration', registration_id=existing_registration.id))
    
    # Check if user is already a member of another team for this event
    existing_membership = db.session.query(EventTeamMember).join(
        EventTeamRegistration
    ).filter(
        EventTeamMember.user_id == current_user.id,
        EventTeamRegistration.event_id == event_id
    ).first()
    
    if existing_membership:
        flash('You are already registered as a member of another team for this event!', 'error')
        return redirect(url_for('event_detail', event_id=event_id))
    
    if request.method == 'POST':
        team_name = request.form.get('team_name')
        member_emails = request.form.getlist('member_emails')
        member_skills = request.form.getlist('member_skills')
        
        # Validate team size (including leader)
        total_members = len([email for email in member_emails if email.strip()]) + 1
        if total_members < event.min_team_size or total_members > event.max_team_size:
            flash(f'Team size must be between {event.min_team_size} and {event.max_team_size} members!', 'error')
            return render_template('events/register_team.html', event=event)
        
        # Create team registration
        team_registration = EventTeamRegistration(
            event_id=event_id,
            team_name=team_name,
            team_leader_id=current_user.id
        )
        db.session.add(team_registration)
        db.session.flush()  # Get the ID
        
        # Add team leader as confirmed member
        leader_member = EventTeamMember(
            team_registration_id=team_registration.id,
            user_id=current_user.id,
            role='leader'
        )
        db.session.add(leader_member)
        
        # Send invitations to other members instead of adding them directly
        invitation_count = 0
        for i, email in enumerate(member_emails):
            if email.strip():
                user = User.query.filter_by(email=email.strip()).first()
                if user:
                    # Check if user is already in another team for this event
                    existing_member = db.session.query(EventTeamMember).join(
                        EventTeamRegistration
                    ).filter(
                        EventTeamMember.user_id == user.id,
                        EventTeamRegistration.event_id == event_id
                    ).first()
                    
                    if existing_member:
                        flash(f'{user.full_name} is already registered for this event in another team!', 'warning')
                        continue
                    
                    # Create invitation
                    invitation = EventTeamInvitation(
                        team_registration_id=team_registration.id,
                        invited_user_id=user.id,
                        invited_by_id=current_user.id,
                        email=email.strip(),
                        skills=member_skills[i] if i < len(member_skills) else '',
                        expires_at=datetime.utcnow() + timedelta(days=7)
                    )
                    db.session.add(invitation)
                    
                    # Create notification
                    notification = Notification(
                        user_id=user.id,
                        title=f'Team Invitation for {event.title}',
                        message=f'{current_user.full_name} invited you to join team "{team_name}" for {event.title}',
                        notification_type='team_invitation',
                        action_url=f'/events/{event_id}/invitations/{invitation.id}'
                    )
                    db.session.add(notification)
                    invitation_count += 1
                else:
                    flash(f'User with email {email} not found!', 'warning')
        
        db.session.commit()
        
        if invitation_count > 0:
            flash(f'Team registered successfully! {invitation_count} invitation(s) sent to team members.', 'success')
        else:
            flash('Team registered successfully!', 'success')
            
        return redirect(url_for('event_detail', event_id=event_id))
    
    return render_template('events/register_team.html', event=event)

# Edit team registration
@app.route('/events/registration/<int:registration_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_event_registration(registration_id):
    from models import EventTeamRegistration, EventTeamMember
    
    registration = EventTeamRegistration.query.get_or_404(registration_id)
    
    # Check if user is team leader
    if registration.team_leader_id != current_user.id:
        flash('Access denied. Only team leaders can edit registrations.', 'error')
        return redirect(url_for('event_detail', event_id=registration.event_id))
    
    # Check if deadline passed
    deadline_passed = datetime.utcnow() > registration.event.registration_deadline
    
    if request.method == 'POST':
        if deadline_passed:
            flash('Cannot edit registration after deadline!', 'error')
            return redirect(url_for('event_detail', event_id=registration.event_id))
        
        # Update team details
        registration.team_name = request.form.get('team_name')
        
        # Remove existing members (except leader)
        EventTeamMember.query.filter_by(
            team_registration_id=registration_id, role='member'
        ).delete()
        
        # Add updated members
        member_emails = request.form.getlist('member_emails')
        member_skills = request.form.getlist('member_skills')
        
        for i, email in enumerate(member_emails):
            if email.strip():
                user = User.query.filter_by(email=email.strip()).first()
                if user:
                    member = EventTeamMember(
                        team_registration_id=registration_id,
                        user_id=user.id,
                        role='member',
                        skills=member_skills[i] if i < len(member_skills) else ''
                    )
                    db.session.add(member)
        
        registration.updated_at = datetime.utcnow()
        db.session.commit()
        flash('Registration updated successfully!', 'success')
        return redirect(url_for('event_detail', event_id=registration.event_id))
    
    return render_template('events/edit_registration.html', 
                         registration=registration, 
                         deadline_passed=deadline_passed)

# Admin: View all registrations
@app.route('/admin/events/<int:event_id>/registrations')
@login_required
def admin_event_registrations(event_id):
    if not current_user.is_admin:
        flash('Access denied', 'error')
        return redirect(url_for('dashboard'))
    
    from models import Event, EventTeamRegistration
    
    event = Event.query.get_or_404(event_id)
    registrations = EventTeamRegistration.query.filter_by(event_id=event_id).all()
    
    # Check and update disqualified teams
    if datetime.utcnow() > event.registration_deadline:
        for reg in registrations:
            team_size = len(reg.members)
            if team_size < event.min_team_size and reg.status == 'registered':
                reg.status = 'disqualified'
        db.session.commit()
    
    return render_template('admin/event_registrations.html', event=event, registrations=registrations)

# Unregister team
@app.route('/events/registration/<int:registration_id>/unregister', methods=['POST'])
@login_required
def unregister_event_team(registration_id):
    from models import EventTeamRegistration
    
    print(f"DEBUG: Unregister attempt - registration_id: {registration_id}, user_id: {current_user.id}")
    
    registration = EventTeamRegistration.query.get_or_404(registration_id)
    print(f"DEBUG: Found registration - team_leader_id: {registration.team_leader_id}")
        
    if registration.team_leader_id != current_user.id:
        flash('Access denied.', 'error')
        return redirect(url_for('dashboard'))
    
    event_id = registration.event_id
    db.session.delete(registration)
    db.session.commit()
    
    flash('Team unregistered successfully!', 'success')
    return redirect(url_for('event_detail', event_id=event_id))

@app.route('/forum/category/<int:category_id>')
@login_required
def forum_category(category_id):
    category = ForumCategory.query.get_or_404(category_id)
    posts = ForumPost.query.filter_by(category_id=category_id).order_by(
        ForumPost.is_pinned.desc(),
        ForumPost.created_at.desc()
    ).all()
    
    return render_template('forum/category.html', category=category, posts=posts)

@app.route('/profile/edit', methods=['GET', 'POST'])
@login_required
def edit_profile():
    if request.method == 'POST':
        current_user.full_name = request.form['full_name']
        current_user.bio = request.form.get('bio', '')
        current_user.skills = request.form.get('skills', '')
        
        db.session.commit()
        flash('Profile updated successfully!', 'success')
        return redirect(url_for('profile'))
    
    return render_template('profile/edit.html')

# API routes for AJAX requests
@app.route('/api/notifications/mark-read/<int:notification_id>', methods=['POST'])
@login_required
def mark_notification_read(notification_id):
    from flask import jsonify
    notification = Notification.query.get(notification_id)
    if notification and notification.user_id == current_user.id:
        notification.is_read = True
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'error': 'Notification not found'}), 404

@app.route('/api/forum/vote', methods=['POST'])
@login_required
def forum_vote():
    from flask import jsonify
    data = request.get_json()
    post_id = data.get('post_id')
    vote_type = data.get('vote_type')
    
    post = ForumPost.query.get(post_id)
    if post:
        if vote_type == 'upvote':
            post.upvotes += 1
        else:
            post.downvotes += 1
        
        db.session.commit()
        
        return jsonify({
            'upvotes': post.upvotes,
            'downvotes': post.downvotes
        })
    
    return jsonify({'error': 'Post not found'}), 404

@app.route('/api/announcements/<int:announcement_id>/react', methods=['POST'])
@login_required
def react_to_announcement(announcement_id):
    from flask import jsonify
    data = request.get_json()
    reaction_type = data.get('reaction_type')  # like, love, celebrate
    
    announcement = Announcement.query.get_or_404(announcement_id)
    
    # Check if user already reacted
    from models import AnnouncementReaction
    existing_reaction = AnnouncementReaction.query.filter_by(
        user_id=current_user.id,
        announcement_id=announcement_id
    ).first()
    
    if existing_reaction:
        if existing_reaction.reaction_type == reaction_type:
            # Remove reaction if same type
            db.session.delete(existing_reaction)
            db.session.commit()
            return jsonify({'success': True, 'action': 'removed'})
        else:
            # Update reaction type
            existing_reaction.reaction_type = reaction_type
            db.session.commit()
            return jsonify({'success': True, 'action': 'updated'})
    else:
        # Create new reaction
        reaction = AnnouncementReaction(
            user_id=current_user.id,
            announcement_id=announcement_id,
            reaction_type=reaction_type
        )
        db.session.add(reaction)
        db.session.commit()
        return jsonify({'success': True, 'action': 'added'})

# Update member role
@app.route('/teams/<int:team_id>/members/<int:member_id>/role', methods=['POST'])
@login_required
def update_member_role(team_id, member_id):
    from models import Team, TeamMember
    
    team = Team.query.get_or_404(team_id)
    member_to_update = TeamMember.query.get_or_404(member_id)
    
    # Check if user is team leader
    leader = TeamMember.query.filter_by(team_id=team_id, user_id=current_user.id, role='leader').first()
    if not leader:
        flash('Access denied. Only team leaders can update member roles.', 'error')
        return redirect(url_for('team_detail', team_id=team_id))
    
    new_role = request.form.get('role')
    member_to_update.role = new_role
    
    db.session.commit()
    flash(f'Member role updated to {new_role}!', 'success')
    return redirect(url_for('team_detail', team_id=team_id))

# Remove team member
@app.route('/teams/<int:team_id>/members/<int:member_id>/remove', methods=['POST'])
@login_required
def remove_member(team_id, member_id):
    from models import Team, TeamMember
    
    team = Team.query.get_or_404(team_id)
    member_to_remove = TeamMember.query.get_or_404(member_id)
    
    # Check if user is team leader
    leader = TeamMember.query.filter_by(team_id=team_id, user_id=current_user.id, role='leader').first()
    if not leader:
        flash('Access denied. Only team leaders can remove members.', 'error')
        return redirect(url_for('team_detail', team_id=team_id))
    
    # Cannot remove leader
    if member_to_remove.role == 'leader':
        flash('Cannot remove team leader. Transfer leadership first.', 'error')
        return redirect(url_for('team_detail', team_id=team_id))
    
    db.session.delete(member_to_remove)
    db.session.commit()
    
    flash('Member removed from team!', 'success')
    return redirect(url_for('team_detail', team_id=team_id))

# Transfer team leadership
@app.route('/teams/<int:team_id>/transfer/<int:member_id>', methods=['POST'])
@login_required
def transfer_leadership(team_id, member_id):
    from models import Team, TeamMember
    
    team = Team.query.get_or_404(team_id)
    new_leader = TeamMember.query.get_or_404(member_id)
    current_leader = TeamMember.query.filter_by(team_id=team_id, user_id=current_user.id, role='leader').first()
    
    if not current_leader:
        flash('Access denied. Only current team leader can transfer leadership.', 'error')
        return redirect(url_for('team_detail', team_id=team_id))
    
    # Update roles
    current_leader.role = 'member'
    new_leader.role = 'leader'
    
    # Update team leader_id
    team.leader_id = new_leader.user_id
    
    db.session.commit()
    flash('Team leadership transferred successfully!', 'success')
    return redirect(url_for('team_detail', team_id=team_id))

# Send team message
@app.route('/teams/<int:team_id>/messages', methods=['POST'])
@login_required
def send_team_message(team_id):
    from models import Team, TeamMember, TeamMessage
    
    team = Team.query.get_or_404(team_id)
    
    # Check if user is team member
    member = TeamMember.query.filter_by(team_id=team_id, user_id=current_user.id).first()
    if not member:
        flash('Access denied. Only team members can send messages.', 'error')
        return redirect(url_for('team_detail', team_id=team_id))
    
    message_content = request.form.get('message')
    if message_content:
        message = TeamMessage(
            team_id=team_id,
            user_id=current_user.id,
            message=message_content
        )
        
        db.session.add(message)
        db.session.commit()
        
        flash('Message sent!', 'success')
    
    return redirect(url_for('team_detail', team_id=team_id))

# Delete team message (admin only)
@app.route('/teams/<int:team_id>/messages/<int:message_id>/delete', methods=['POST'])
@login_required
def delete_team_message(team_id, message_id):
    from models import TeamMessage
    
    if not current_user.is_admin:
        flash('Access denied. Only admins can delete messages.', 'error')
        return redirect(url_for('team_detail', team_id=team_id))
    
    message = TeamMessage.query.get_or_404(message_id)
    message.is_deleted = True
    message.deleted_by = current_user.id
    
    db.session.commit()
    flash('Message deleted!', 'success')
    return redirect(url_for('team_detail', team_id=team_id))

# Delete announcement (admin only)
@app.route('/announcements/<int:announcement_id>/delete', methods=['POST'])
@login_required
def delete_announcement(announcement_id):
    from models import Announcement
    
    if not current_user.is_admin:
        flash('Access denied. Only admins can delete announcements.', 'error')
        return redirect(url_for('announcements'))
    
    announcement = Announcement.query.get_or_404(announcement_id)
    db.session.delete(announcement)
    db.session.commit()
    
    flash('Announcement deleted successfully!', 'success')
    return redirect(url_for('announcements'))