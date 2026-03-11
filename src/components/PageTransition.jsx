/**
 * PageTransition.jsx
 * Wrap any page content with this for a smooth iOS-style entrance.
 *
 * Usage:
 *   import PageTransition from '@/components/PageTransition';
 *   const MyPage = () => (
 *     <PageTransition>
 *       <div>...content...</div>
 *     </PageTransition>
 *   );
 */
import React from 'react';
import { motion } from 'framer-motion';

const variants = {
  initial: { opacity: 0, y: 14, scale: 0.995 },
  animate: { opacity: 1, y: 0,  scale: 1,
    transition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }
  },
  exit: { opacity: 0, y: -8, scale: 0.998,
    transition: { duration: 0.2, ease: 'easeIn' }
  },
};

const PageTransition = ({ children, className = '' }) => (
  <motion.div
    variants={variants}
    initial="initial"
    animate="animate"
    exit="exit"
    className={className}
  >
    {children}
  </motion.div>
);

export default PageTransition;
