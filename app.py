from flask import Flask
from werkzeug.security import generate_password_hash
import os
from dotenv import load_dotenv

# Import extensions
from extensions import db, login_manager, init_extensions
# In your Flask app (app.py)
from datetime import datetime

load_dotenv()

def create_app():
    """Application factory pattern"""
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///techsphere.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOAD_FOLDER'] = 'static/uploads'
    
    # Ensure upload directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Initialize extensions
    init_extensions(app)
    
    # Add custom template filters
    @app.template_filter('nl2br')
    def nl2br_filter(text):
        """Convert newlines to <br> tags"""
        if text:
            return text.replace('\n', '<br>')
        return text
    
    # Import models after extensions are initialized
    from models import User, ForumCategory, Achievement
    
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))
    
    # Import routes directly (no blueprint)
    with app.app_context():
        import routes
    
    return app

def create_sample_data():
    """Create sample data for the application"""
    from models import ForumCategory, Achievement
    
    # Create forum categories
    categories = [
        {'name': 'Web Development', 'description': 'HTML, CSS, JavaScript, React, Vue, Angular', 'icon': 'code', 'color': 'blue'},
        {'name': 'Machine Learning', 'description': 'AI, ML, Deep Learning, Data Science', 'icon': 'brain', 'color': 'purple'},
        {'name': 'Mobile Development', 'description': 'iOS, Android, React Native, Flutter', 'icon': 'smartphone', 'color': 'green'},
        {'name': 'Career Advice', 'description': 'Job hunting, interviews, career growth', 'icon': 'briefcase', 'color': 'orange'},
        {'name': 'Project Help', 'description': 'Get help with your projects', 'icon': 'help-circle', 'color': 'red'}
    ]
    
    for cat_data in categories:
        if not ForumCategory.query.filter_by(name=cat_data['name']).first():
            category = ForumCategory(**cat_data)
            db.session.add(category)
    
    # Create achievements
    achievements = [
        {'name': 'First Post', 'description': 'Created your first forum post', 'icon': 'edit', 'badge_color': 'blue', 'points': 10},
        {'name': 'Helpful Member', 'description': 'Received 10 upvotes on forum posts', 'icon': 'thumbs-up', 'badge_color': 'green', 'points': 50},
        {'name': 'Event Participant', 'description': 'Participated in your first event', 'icon': 'calendar', 'badge_color': 'purple', 'points': 25},
        {'name': 'Team Player', 'description': 'Joined a team for hackathon', 'icon': 'users', 'badge_color': 'orange', 'points': 30}
    ]
    
    for ach_data in achievements:
        if not Achievement.query.filter_by(name=ach_data['name']).first():
            achievement = Achievement(**ach_data)
            db.session.add(achievement)
    
    db.session.commit()

#if __name__ == '__main__':
app = create_app()

with app.app_context():
    db.create_all()
    
    # Create admin user if it doesn't exist
    from models import User
    admin = User.query.filter_by(email='admin@techsphere.com').first()
    if not admin:
        admin = User(
            username='admin',
            email='admin@techsphere.com',
            password_hash=generate_password_hash('admin123'),
            is_admin=True,
            full_name='System Administrator'
        )
        db.session.add(admin)
        db.session.commit()
    
    # Create sample data
    create_sample_data()


#app.run(debug=True)

