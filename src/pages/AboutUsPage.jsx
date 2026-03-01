import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Cloud, Shield, Zap, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Helmet } from 'react-helmet';

const AboutUsPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <>
      <Helmet>
        <title>{t('aboutUs')} - CloudCampus</title>
      </Helmet>
      <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
        {/* Background Blobs */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
           <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[100px]" />
           <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[100px]" />
        </div>

        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t('back')}
          </Button>
        </div>

        <div className="max-w-4xl mx-auto w-full px-6 pb-20">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="space-y-12"
          >
            {/* Hero Section */}
            <motion.div variants={itemVariants} className="text-center space-y-4">
              <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl mb-4 backdrop-blur-sm border border-indigo-500/20">
                <Cloud className="w-16 h-16 text-indigo-500" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
                CloudCampus
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {t('missionText')}
              </p>
            </motion.div>

            {/* Features Grid */}
            <motion.div variants={itemVariants}>
              <h2 className="text-2xl font-bold text-center mb-8">{t('platformFeatures')}</h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="p-6 rounded-2xl bg-card/50 border border-white/5 backdrop-blur-md hover:border-indigo-500/30 transition-colors">
                  <Zap className="w-8 h-8 text-yellow-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('feature1')}</h3>
                  <p className="text-sm text-muted-foreground">Instant messaging and notifications keep everyone in the loop.</p>
                </div>
                <div className="p-6 rounded-2xl bg-card/50 border border-white/5 backdrop-blur-md hover:border-purple-500/30 transition-colors">
                  <Users className="w-8 h-8 text-purple-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('feature2')}</h3>
                  <p className="text-sm text-muted-foreground">Transparent and accessible academic records for students and parents.</p>
                </div>
                <div className="p-6 rounded-2xl bg-card/50 border border-white/5 backdrop-blur-md hover:border-green-500/30 transition-colors">
                  <Shield className="w-8 h-8 text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('feature3')}</h3>
                  <p className="text-sm text-muted-foreground">Enterprise-grade security for sensitive educational data.</p>
                </div>
              </div>
            </motion.div>

            {/* Contact CTA */}
            <motion.div variants={itemVariants} className="text-center">
              <div className="p-8 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-2xl">
                <h2 className="text-2xl font-bold mb-4">{t('getInTouch')}</h2>
                <p className="mb-6 opacity-90">Ready to transform your school experience? Contact our team today.</p>
                <Button 
                  variant="secondary" 
                  size="lg" 
                  onClick={() => navigate('/contact')}
                  className="font-semibold"
                >
                  {t('contactUs')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default AboutUsPage;