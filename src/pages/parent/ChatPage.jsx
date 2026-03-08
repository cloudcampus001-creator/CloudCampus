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
      <div
        className="-mx-4 -mt-4 -mb-24 md:-mx-8 md:-mt-8 md:-mb-8 overflow-hidden"
        style={{ height: 'calc(100vh - 65px)' }}
      >
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
