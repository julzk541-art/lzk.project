import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:4000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function downloadExcel(params) {
  const response = await api.get('/admin/export', { params, responseType: 'blob' });
  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const fileName = match?.[1] || '优秀生信息名单.xlsx';

  const blob = new Blob([response.data], { type: response.headers['content-type'] });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = decodeURIComponent(fileName);
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadImportTemplate() {
  const response = await api.get('/admin/import-template', { responseType: 'blob' });
  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const fileName = match?.[1] || '优秀生导入模板.xlsx';
  const blob = new Blob([response.data], { type: response.headers['content-type'] });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = decodeURIComponent(fileName);
  a.click();
  URL.revokeObjectURL(url);
}

export default api;
