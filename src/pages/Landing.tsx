import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';

const Landing = () => {
  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Icon icon="solar:code-bold" className="text-white" fontSize={20} />
            </div>
            <span className="text-xl font-bold tracking-tight">TechSphere</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors">
              Login
            </Link>
            <Link to="/register" className="px-4 py-2 bg-[#212B36] text-white rounded-lg text-sm font-bold hover:bg-[#161C24] transition-all">
              Join Now
            </Link>
          </div>
        </div>
      </header>

      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-bold uppercase tracking-wider mb-6 inline-block">
              IET, DDU Gorakhpur University
            </span>
            <h1 className="text-4xl md:text-6xl font-black text-[#212B36] mb-6 tracking-tight leading-tight">
              Elevate Your <span className="text-indigo-600">Technical</span><br />
              Journey with TechSphere
            </h1>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
              The premier technical community for aspiring engineers. Connect, collaborate, and compete in modern technology domains.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/register" className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 text-white rounded-lg font-bold text-base hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100">
                Get Started <Icon icon="solar:arrow-right-bold" />
              </Link>
              <a href="#about" className="w-full sm:w-auto px-8 py-3.5 bg-white text-gray-900 border border-gray-200 rounded-lg font-bold text-base hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                Learn More
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="about" className="py-20 bg-[#F4F6F8]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: 'solar:bolt-bold', title: 'Events', desc: 'Workshops, seminars, and tech talks from industry experts.' },
              { icon: 'solar:cup-bold', title: 'Challenges', desc: 'Weekly coding challenges and hackathons to test your skills.' },
              { icon: 'solar:users-group-rounded-bold', title: 'Community', desc: 'Network with peers and mentors from various engineering branches.' },
            ].map((f, i) => (
              <div key={i} className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center mb-6 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Icon icon={f.icon} fontSize={28} />
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-gray-500 leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-12 bg-white px-6 border-t border-gray-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Icon icon="solar:code-bold" className="text-white" fontSize={18} />
            </div>
            <span className="text-lg font-bold tracking-tight">TechSphere</span>
          </div>
          <p className="text-gray-400 text-xs font-medium">
            © 2026 TechSphere. Institute of Engineering & Technology, DDUGU.
          </p>
          <div className="flex gap-4">
            <Icon icon="solar:global-bold" className="text-gray-400 hover:text-indigo-600 cursor-pointer" fontSize={20} />
            <Icon icon="solar:shield-check-bold" className="text-gray-400 hover:text-indigo-600 cursor-pointer" fontSize={20} />
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
