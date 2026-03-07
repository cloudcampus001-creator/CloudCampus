import React from 'react';
import ChatInterface from '@/components/ChatInterface';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';

const ChatPage = () => {
  const { t } = useLanguage();
  const userId = localStorage.getItem('userId');
  const studentName = localStorage.getItem('studentName');
  const classId = localStorage.getItem('classId');
  const schoolId = localStorage.getItem('schoolId');

  const identityName = `${t('parentOf')} ${studentName}`;
  const role = 'parent';

  const relatedContext = {
    classId: classId ? parseInt(classId) : null,
    schoolId: schoolId ? parseInt(schoolId) : null,
  };

  return (
    <>
      <Helmet>
        <title>{t('chat')} - {t('role_parent')}</title>
      </Helmet>
      {/* Full height, no padding — chat fills the entire page area */}
      <div className="h-full w-full overflow-hidden">
        <ChatInterface
          currentUserRole={role}
          currentUserId={userId}
          currentUserName={identityName}
          relatedContext={relatedContext}
        />
      </div>
    </>
  );
};

export default ChatPage;
