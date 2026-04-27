export function calcAutoTier(student) {
  const gradeRank = Number(student.grade_rank ?? student.gradeRank);
  const classRank = Number(student.class_rank ?? student.classRank);
  const totalScore = Number(student.total_score ?? student.totalScore);
  const hasCoreData = !!(student.latest_exam_name && Number.isFinite(totalScore) && totalScore > 0);

  if ((gradeRank > 0 && gradeRank <= 30) || totalScore >= 565) return '特优生';
  if ((gradeRank > 0 && gradeRank <= 50) || (classRank > 0 && classRank <= 3) || totalScore >= 550) return '一批预录';
  if ((gradeRank > 0 && gradeRank <= 100) || (classRank > 0 && classRank <= 10) || totalScore >= 530) return '二等预录';

  if (!hasCoreData || (!gradeRank && !classRank && !totalScore)) return '待观察';
  return '待观察';
}
