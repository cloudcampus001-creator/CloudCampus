import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, GraduationCap, Shield, Key, ArrowLeft, Cloud, UserCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Helmet } from 'react-helmet';

const RoleSelectionPage = () => {
  const { schoolId } = useParams();
  const navigate = useNavigate();
  
  const roles = [
    { 
      id: 'parent', 
      title: 'Parent', 
      icon: User, 
      description: 'View student progress & communicate',
      color: 'text-blue-500', 
      bg: 'bg-blue-500/10', 
      border: 'hover:border-blue-500/50',
      gradient: 'from-blue-500 to-cyan-400',
      path: `/login/parent/${schoolId}` 
    },
    { 
      id: 'teacher', 
      title: 'Teacher', 
      icon: GraduationCap, 
      description: 'Manage classes, marks & resources',
      color: 'text-purple-500', 
      bg: 'bg-purple-500/10', 
      border: 'hover:border-purple-500/50', 
      gradient: 'from-purple-500 to-pink-500',
      path: `/login/teacher/${schoolId}` 
    },
    { 
      id: 'discipline', 
      title: 'Discipline Master', 
      icon: Shield, 
      description: 'Monitor conduct & manage records',
      color: 'text-orange-500', 
      bg: 'bg-orange-500/10', 
      border: 'hover:border-orange-500/50', 
      gradient: 'from-orange-500 to-red-500',
      path: `/login/discipline/${schoolId}` 
    },
    { 
      id: 'vice_principal', 
      title: 'Vice Principal', 
      icon: UserCheck, 
      description: 'Oversee academic operations',
      color: 'text-pink-500', 
      bg: 'bg-pink-500/10', 
      border: 'hover:border-pink-500/50', 
      gradient: 'from-pink-500 to-rose-500',
      path: `/login/vice-principal/${schoolId}` 
    },
    { 
      id: 'admin', 
      title: 'Administrator', 
      icon: Key, 
      description: 'Full system configuration',
      color: 'text-red-500', 
      bg: 'bg-red-500/10', 
      border: 'hover:border-red-500/50', 
      gradient: 'from-red-500 to-orange-600',
      path: `/login/administrator/${schoolId}` 
    },
  ];

  return (
    <>
      <Helmet>
        <title>Select Role - CloudCampus</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans">
         {/* Background effects */}
         <div className="absolute inset-0 -z-10 bg-background">
           <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
           <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] animate-pulse delay-1000" />
         </div>

         <div className="w-full max-w-7xl space-y-12">
           <div className="text-center space-y-4">
             <Button variant="ghost" className="mb-4 hover:bg-white/5" onClick={() => navigate('/')}>
                 <ArrowLeft className="mr-2 h-4 w-4" /> Back to School Selection
             </Button>
             
             <motion.div 
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="flex justify-center mb-6"
             >
               <div className="p-4 bg-primary/10 rounded-full ring-1 ring-primary/20">
                 <Cloud className="w-12 h-12 text-primary" />
               </div>
             </motion.div>
             
             <h1 className="text-4xl md:text-5xl font-bold text-glow tracking-tight">Who are you?</h1>
             <p className="text-lg text-muted-foreground max-w-lg mx-auto">Select your role to access the appropriate dashboard and tools for your daily tasks.</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 px-4">
             {roles.map((role, index) => (
               <motion.div
                 key={role.id}
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: index * 0.1 }}
                 className="h-full"
               >
                 <Link to={role.path} className="block h-full">
                   <div className={`
                     h-full glass p-6 rounded-3xl flex flex-col items-center text-center gap-4
                     border border-white/5 transition-all duration-300 cursor-pointer
                     ${role.border} hover:shadow-2xl hover:-translate-y-2 group relative overflow-hidden
                   `}>
                     {/* Hover Gradient Overlay */}
                     <div className={`absolute inset-0 bg-gradient-to-br ${role.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                     
                     <div className={`
                       p-5 rounded-2xl ${role.bg} ${role.color} 
                       group-hover:scale-110 transition-transform duration-300 
                       ring-1 ring-white/10 shadow-inner
                     `}>
                       <role.icon className="w-8 h-8" />
                     </div>
                     
                     <div className="space-y-2 z-10">
                       <h3 className="text-lg font-bold">{role.title}</h3>
                       <p className="text-xs text-muted-foreground line-clamp-2">{role.description}</p>
                     </div>
                     
                     <div className="mt-auto pt-4 w-full z-10">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors flex items-center justify-center gap-1">
                          Login <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                        </div>
                     </div>
                   </div>
                 </Link>
               </motion.div>
             ))}
           </div>
         </div>
      </div>
    </>
  );
};

export default RoleSelectionPage;