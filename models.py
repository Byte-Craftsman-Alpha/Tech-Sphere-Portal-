from extensions import db
from flask_login import UserMixin
from datetime import datetime

# User model
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    phone_number = db.Column(db.String(20))
    bio = db.Column(db.Text)
    avatar = db.Column(db.String(200), default='default-avatar.png')
    skills = db.Column(db.Text)  # JSON string of skills
    is_admin = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    posts = db.relationship('ForumPost', backref='author', lazy=True)
    comments = db.relationship('ForumComment', backref='author', lazy=True)
    events_created = db.relationship('Event', backref='creator', lazy=True)
    announcements = db.relationship('Announcement', backref='author', lazy=True)
    achievements = db.relationship('UserAchievement', backref='user', lazy=True)

# Event model
class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    event_type = db.Column(db.String(50), nullable=False)  # hackathon, seminar, workshop, competition
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    venue = db.Column(db.String(200))
    virtual_link = db.Column(db.String(500))
    max_participants = db.Column(db.Integer)
    
    min_team_size = db.Column(db.Integer, default=1)
    max_team_size = db.Column(db.Integer, default=5)
    registration_deadline = db.Column(db.DateTime, nullable=False)
    
    rules = db.Column(db.Text)
    prizes = db.Column(db.Text)
    banner_image = db.Column(db.String(200))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    creator_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    

    # Relationships
    registrations = db.relationship('EventRegistration', backref='event', lazy=True)
    resources = db.relationship('EventResource', backref='event', lazy=True)

# Add to models.py after the existing EventRegistration model
class EventTeamRegistration(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('event.id'), nullable=False)
    team_name = db.Column(db.String(100), nullable=False)
    team_leader_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), default='registered')  # registered, qualified, disqualified
    registered_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    event = db.relationship('Event', backref='team_registrations')
    team_leader = db.relationship('User', backref='led_event_teams')
    members = db.relationship('EventTeamMember', backref='team_registration', cascade='all, delete-orphan')

class EventTeamMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    team_registration_id = db.Column(db.Integer, db.ForeignKey('event_team_registration.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    role = db.Column(db.String(50), default='member')  # leader, member
    skills = db.Column(db.Text)  # JSON string of member skills
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='event_team_memberships')

# Event Team Invitation model
class EventTeamInvitation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    team_registration_id = db.Column(db.Integer, db.ForeignKey('event_team_registration.id'), nullable=False)
    invited_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    invited_by_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    email = db.Column(db.String(120), nullable=False)  # Email used for invitation
    role = db.Column(db.String(50), default='member')
    skills = db.Column(db.Text)  # Skills specified during invitation
    status = db.Column(db.String(20), default='pending')  # pending, accepted, rejected, expired
    invited_at = db.Column(db.DateTime, default=datetime.utcnow)
    responded_at = db.Column(db.DateTime)
    expires_at = db.Column(db.DateTime)  # Auto-expire invitations after 7 days
    
    # Relationships
    team_registration = db.relationship('EventTeamRegistration', backref='invitations')
    invited_user = db.relationship('User', foreign_keys=[invited_user_id], backref='received_team_invitations')
    invited_by = db.relationship('User', foreign_keys=[invited_by_id], backref='sent_team_invitations')

# Event Registration model
class EventRegistration(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    event_id = db.Column(db.Integer, db.ForeignKey('event.id'), nullable=False)
    team_name = db.Column(db.String(100))
    additional_info = db.Column(db.Text)
    registered_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='event_registrations')

# Event Resources model
class EventResource(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('event.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    file_path = db.Column(db.String(500))
    external_link = db.Column(db.String(500))
    resource_type = db.Column(db.String(50))  # pdf, video, link, code
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

# Announcement model
class Announcement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(100), nullable=False)
    priority = db.Column(db.String(20), default='normal')  # high, normal, low
    is_pinned = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Relationships
    reactions = db.relationship('AnnouncementReaction', backref='announcement', lazy=True)

# Announcement Reactions model
class AnnouncementReaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    announcement_id = db.Column(db.Integer, db.ForeignKey('announcement.id'), nullable=False)
    reaction_type = db.Column(db.String(20), nullable=False)  # like, love, celebrate
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='announcement_reactions')

# Forum Category model
class ForumCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    icon = db.Column(db.String(50))
    color = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    posts = db.relationship('ForumPost', backref='category', lazy=True)

# Forum Post model
class ForumPost(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    tags = db.Column(db.String(500))  # comma-separated tags
    is_pinned = db.Column(db.Boolean, default=False)
    is_solved = db.Column(db.Boolean, default=False)
    views = db.Column(db.Integer, default=0)
    upvotes = db.Column(db.Integer, default=0)
    downvotes = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign Keys
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('forum_category.id'), nullable=False)
    
    # Relationships
    comments = db.relationship('ForumComment', backref='post', lazy=True, cascade='all, delete-orphan')
    votes = db.relationship('ForumVote', backref='post', lazy=True, cascade='all, delete-orphan')

# Forum Comment model
class ForumComment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    is_accepted = db.Column(db.Boolean, default=False)
    upvotes = db.Column(db.Integer, default=0)
    downvotes = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign Keys
    post_id = db.Column(db.Integer, db.ForeignKey('forum_post.id'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('forum_comment.id'))  # NEW FIELD
    
    # Relationships
    votes = db.relationship('ForumCommentVote', backref='comment', lazy=True, cascade='all, delete-orphan')
    replies = db.relationship('ForumComment', backref=db.backref('parent', remote_side=[id]))  # NEW RELATIONSHIP

# Forum Vote model
class ForumVote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('forum_post.id'), nullable=False)
    vote_type = db.Column(db.String(10), nullable=False)  # upvote, downvote
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='forum_votes')

# Forum Comment Vote model
class ForumCommentVote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    comment_id = db.Column(db.Integer, db.ForeignKey('forum_comment.id'), nullable=False)
    vote_type = db.Column(db.String(10), nullable=False)  # upvote, downvote
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='forum_comment_votes')

# Resource model
class Resource(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    content_type = db.Column(db.String(50), nullable=False)  # tutorial, guide, cheatsheet, video
    topic = db.Column(db.String(100), nullable=False)
    difficulty = db.Column(db.String(20), nullable=False)  # beginner, intermediate, advanced
    file_path = db.Column(db.String(500))
    external_link = db.Column(db.String(500))
    thumbnail = db.Column(db.String(200))
    downloads = db.Column(db.Integer, default=0)
    rating = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    uploader_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    uploader = db.relationship('User', backref='uploaded_resources')
    reviews = db.relationship('ResourceReview', backref='resource', lazy=True)

# Resource Review model
class ResourceReview(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    resource_id = db.Column(db.Integer, db.ForeignKey('resource.id'), nullable=False)
    rating = db.Column(db.Integer, nullable=False)  # 1-5 stars
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='resource_reviews')

# Achievement model
class Achievement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    icon = db.Column(db.String(100))
    badge_color = db.Column(db.String(20))
    points = db.Column(db.Integer, default=0)
    criteria = db.Column(db.Text)  # JSON string describing criteria
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# User Achievement model
class UserAchievement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    achievement_id = db.Column(db.Integer, db.ForeignKey('achievement.id'), nullable=False)
    earned_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    achievement = db.relationship('Achievement', backref='user_achievements')

# Team model
class Team(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    project_idea = db.Column(db.Text)
    max_members = db.Column(db.Integer, default=4)
    skills_needed = db.Column(db.Text)  # JSON string
    is_open = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    leader_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    event_id = db.Column(db.Integer, db.ForeignKey('event.id'))
    
    leader = db.relationship('User', backref='led_teams')
    event = db.relationship('Event', backref='teams')
    members = db.relationship('TeamMember', backref='team', lazy=True)

# Team Member model
class TeamMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    role = db.Column(db.String(50))
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='team_memberships')

# Notification model
class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    notification_type = db.Column(db.String(50), nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    action_url = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='notifications')

# Team Join Request model
class TeamJoinRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    message = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime)
    reviewed_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    
    team = db.relationship('Team', backref='join_requests')
    user = db.relationship('User', foreign_keys=[user_id], backref='team_requests')
    reviewer = db.relationship('User', foreign_keys=[reviewed_by])

# Team Discussion Message model
class TeamMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    message_type = db.Column(db.String(20), default='text')  # text, file, image
    file_url = db.Column(db.String(500))
    is_deleted = db.Column(db.Boolean, default=False)
    deleted_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    team = db.relationship('Team', backref='messages')
    user = db.relationship('User', foreign_keys=[user_id], backref='team_messages')
    deleted_by_user = db.relationship('User', foreign_keys=[deleted_by])
    