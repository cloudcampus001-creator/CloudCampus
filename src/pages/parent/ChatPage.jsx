import React from 'react';
import ChatInterface from '@/components/ChatInterface';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';

const ChatPage = () => {
  const { t } = useLanguage();

  // userId for parents = student matricule (set by saveSession + mirrored to localStorage)
  // Fall back to studentMatricule in case userId wasn't mirrored (old session edge case)
  const userId =
    localStorage.getItem('userId') ||
    localStorage.getItem('studentMatricule') ||
    '';

  const studentName = localStorage.getItem('studentName') || '';
  const userName    = localStorage.getItem('userName')    || '';
  const classId     = localStorage.getItem('classId')     || '';
  const schoolId    = localStorage.getItem('schoolId')    || '';

  // Parse schoolId robustly — parseInt returns NaN on '' or null
  const parsedSchoolId = schoolId ? parseInt(schoolId, 10) : null;
  const parsedClassId  = classId  ? parseInt(classId,  10) : null;

  // Display name shown in conversations — prefer explicit userName, fall back to constructed
  const identityName = userName || `${t('parentOf')} ${studentName}`;

  const relatedContext = {
    classId:  Number.isFinite(parsedClassId)  ? parsedClassId  : null,
    schoolId: Number.isFinite(parsedSchoolId) ? parsedSchoolId : null,
  };

  const chatHeight = 'calc(100vh - 130px)';

  return (
    <>
      <Helmet>
        <title>{t('chat')} - {t('role_parent')}</title>
      </Helmet>
      <div
        className="-mx-4 -mt-4 -mb-24 md:-mx-8 md:-mt-8 md:-mb-8 overflow-hidden md:h-screen"
        style={{ height: chatHeight }}
      >
        <ChatInterface
          currentUserRole="parent"
          currentUserId={userId}
          currentUserName={identityName}
          relatedContext={relatedContext}
        />
      </div>
    </>
  );
};

export default ChatPage;
