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
    schoolId: schoolId ? parseInt(schoolId) : null
  };

  return (
    <>
      <Helmet>
        <title>{t('chat')} - {t('role_parent')}</title>
      </Helmet>
      <div className="p-4 h-full max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">{t('messages')}</h1>
          <p className="text-muted-foreground">{t('messagesDesc')}</p>
        </div>
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