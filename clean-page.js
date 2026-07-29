const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', 'yuva matirial', 'koli samaj inam vitran 2026', 'koli samaj inam vitran 2026 app', 'src', 'app', 'dashboard', 'students', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// The photo section UI (for both isAddingNew and editingStudent)
const photoSectionRegex = /<div className="space-y-5 sm:space-y-6">\s*\{\(\['marksheetPhotoBase64', 'aadhaarPhotoBase64'\] as const\)\.map\(f => \{[\s\S]*?\}\)\}\s*<\/div>/g;
content = content.replace(photoSectionRegex, '');

// Also remove from editingStudent if the classname differs slightly
const photoSectionRegex2 = /<div className="space-y-6 sm:space-y-8">\s*\{\(\['marksheetPhotoBase64', 'aadhaarPhotoBase64'\] as const\)\.map\(f => \{[\s\S]*?\}\)\}\s*<\/div>/g;
content = content.replace(photoSectionRegex2, '');

// Remove table cell 'View Photos' if it exists
content = content.replace(/<TableCell>\s*<Button variant="ghost".*?handleViewPhotosClick.*?<\/TableCell>/g, '');
content = content.replace(/<TableHead>ફોટો<\/TableHead>/g, '');
content = content.replace(/<TableCell>\s*<Button[^>]*onClick=\{\(\) => handleViewPhotosClick\(student\)\}[^>]*>[\s\S]*?<\/Button>\s*<\/TableCell>/g, '');


// Remove states
content = content.replace(/const \[previewImage, setPreviewImage\].*?;\n/g, '');
content = content.replace(/const \[zoomLevel, setZoomLevel\].*?;\n/g, '');
content = content.replace(/const \[position, setPosition\].*?;\n/g, '');
content = content.replace(/const \[isDragging, setIsDragging\].*?;\n/g, '');
content = content.replace(/const dragStart = useRef.*?\n/g, '');
content = content.replace(/const touchStartDist = useRef.*?\n/g, '');
content = content.replace(/const \[photoLoading, setPhotoLoading\].*?\n/g, '');
content = content.replace(/const \[isFetchingPhotos, setIsFetchingPhotos\].*?\n/g, '');
content = content.replace(/const \[viewPhotosModal, setViewPhotosModal\] = useState.*?;\n/gs, '');
content = content.replace(/const \[isFetchingPhotosForView, setIsFetchingPhotosForView\].*?;\n/g, '');

// Remove functions
content = content.replace(/const openPreview =.*?;\n  \};\n/gs, '');
content = content.replace(/const closePreview =.*?;\n  \};\n/gs, '');
content = content.replace(/const ensureBase64Prefix =.*?;\n  \};\n/gs, '');
content = content.replace(/const triggerEditCamera =.*?;\n  \};\n/gs, '');
content = content.replace(/const triggerEditGallery =.*?;\n  \};\n/gs, '');
content = content.replace(/const handleMouseDown =.*?;\n  \};\n/gs, '');
content = content.replace(/const handleMouseMove =.*?;\n  \};\n/gs, '');
content = content.replace(/const handleMouseUp =.*?;\n/g, '');
content = content.replace(/const handleTouchStart =.*?;\n  \};\n/gs, '');
content = content.replace(/const handleTouchMove =.*?;\n  \};\n/gs, '');
content = content.replace(/const handleTouchEnd =.*?;\n/g, '');
content = content.replace(/const handleDownload =.*?;\n  \}, \[previewImage, toast\]\);\n/gs, '');

// Clean up useEffects
content = content.replace(/useEffect\(\(\) => \{\n    if \(typeof window !== 'undefined'\) \{\n      const callback =.*?\}, \[\]\);\n/gs, '');
content = content.replace(/if \(!hash\.includes\('preview'\)\) \{[\s\S]*?\}/g, '');

// Remove handleImageReplace
content = content.replace(/const handleImageReplace = useCallback.*?\}, \[toast\]\);\n/gs, '');

// Clean handleFixDatabase entirely since we don't need it
content = content.replace(/const handleFixDatabase = async \(\) => \{[\s\S]*?finally \{\n      setIsFixingDb\(false\);\n    \}\n  \};\n/g, '');

// Clean handleViewPhotosClick
content = content.replace(/const handleViewPhotosClick = async \(\w+\: \w+\) => \{[\s\S]*?finally \{\n      setIsFetchingPhotosForView\(null\);\n    \}\n  \};\n/g, '');

// Clean handleEditClick
content = content.replace(/const handleEditClick = async \(student: StudentData\) => \{[\s\S]*?finally \{ setIsFetchingPhotos\(null\); \}\n  \};\n/g, `const handleEditClick = (student: StudentData) => {
    window.location.hash = 'edit';
    setEditingStudent(student);
  };\n`);

// Clean handleBulkTrash
content = content.replace(/const \{ marksheetPhotoBase64, aadhaarPhotoBase64, \.\.\.cleanData \} = s;\n        batch\.set\(trashRef, \{ \.\.\.cleanData/g, `batch.set(trashRef, { ...s`);
content = content.replace(/deleteDocumentNonBlocking\(doc\(firestore, 'student_photos', s\.id\)\)\.catch\(\(\) => \{\}\);\n/g, '');

// Clean handleSaveNew
content = content.replace(/const \{ marksheetPhotoBase64, aadhaarPhotoBase64, \.\.\.textData \} = newStudent;/g, `const textData = newStudent;`);
content = content.replace(/const photoData = \{[\s\S]*?\};\n/g, '');
content = content.replace(/const \{ saveStudentWithPhotosNonBlocking \} = await import\('@\/firebase'\);\n      saveStudentWithPhotosNonBlocking\(firestore, studentData, photoData\)/g, `const { saveStudentNonBlocking } = await import('@/firebase');\n      saveStudentNonBlocking(firestore, studentData)`);

// Clean handleUpdate
content = content.replace(/const \{ marksheetPhotoBase64, aadhaarPhotoBase64, \.\.\.studentTextData \} = editingStudent;/g, `const studentTextData = editingStudent;`);
content = content.replace(/updateStudentNonBlocking\(firestore, editingStudent\.id, studentData, photoData\)/g, `updateStudentNonBlocking(firestore, editingStudent.id, studentData)`);

// Clean types
content = content.replace(/  marksheetPhotoBase64\?: string;\n/g, '');
content = content.replace(/  aadhaarPhotoBase64\?: string;\n/g, '');
content = content.replace(/    marksheetPhotoBase64: '',\n/g, '');
content = content.replace(/    aadhaarPhotoBase64: ''\n/g, '');

// Clean imports
content = content.replace(/import \{ compressImageToBase64, compressDataUrl \} from '@\/lib\/image';\n/g, '');
content = content.replace(/import \{ CameraModal \} from '@\/components\/CameraModal';\n/g, '');

// Write file
fs.writeFileSync(filePath, content);
