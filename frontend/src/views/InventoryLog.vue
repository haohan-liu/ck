<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { getLogs, deleteLogs } from '../api/inventory.js'
import { getCategories } from '../api/categories.js'
import { getProducts } from '../api/products.js'
import { MyFilterSelect, MyFilterSearch, MyModal, MyMessage } from '../components/ui/index.js'
import ExcelJS from 'exceljs'

// ─── 日志数据 ───────────────────────────────────────────────────────────────
const logs = ref([])
const loading = ref(false)
const error = ref('')
const filterType = ref('')
const filterKeyword = ref('')

// ─── 分页状态 ───────────────────────────────────────────────────────────────
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1)

// ─── 批量选择状态 ────────────────────────────────────────────────────────────
const selectedIds = ref(new Set())
const selectMode = ref(false) // 是否进入多选模式

// ─── 弹窗状态 ───────────────────────────────────────────────────────────────
const showExportModal = ref(false)
const showDeleteModal = ref(false)

const typeOptions = [
  { label: '全部类型', value: '' },
  { label: '新增', value: 'add' },
  { label: '入库', value: 'in' },
  { label: '出库', value: 'out' },
  { label: '调整', value: 'adjust' },
]

// ─── 每页条数：简洁自定义下拉（无筛选图标，列表与公共筛选同色） ───────────────
const pageSizeOptions = [10, 20, 50, 100]
const pageSizeOpen = ref(false)
const pageSizeRootRef = ref(null)

function togglePageSizeOpen() {
  pageSizeOpen.value = !pageSizeOpen.value
}

function pickPageSize(n) {
  pageSize.value = n
  pageSizeOpen.value = false
  currentPage.value = 1
  loadLogs()
}

function pageSizeOutsideClick(e) {
  if (!pageSizeRootRef.value?.contains(e.target)) pageSizeOpen.value = false
}

watch(pageSizeOpen, (open) => {
  if (open) document.addEventListener('mousedown', pageSizeOutsideClick)
  else document.removeEventListener('mousedown', pageSizeOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', pageSizeOutsideClick)
})

// ─── 加载日志 ───────────────────────────────────────────────────────────────
async function loadLogs() {
  loading.value = true
  error.value = ''
  try {
    const params = {}
    if (filterType.value) params.type = filterType.value
    if (filterKeyword.value.trim()) params.keyword = filterKeyword.value.trim()
    params.limit = pageSize.value
    params.offset = (currentPage.value - 1) * pageSize.value

    const res = await getLogs(params)
    logs.value = res.data.data || []
    total.value = res.data.total || 0

    selectedIds.value.clear()
  } catch (e) {
    MyMessage.error(e.response?.data?.error || '加载库存日志失败')
  } finally {
    loading.value = false
  }
}

// ─── 搜索防抖 ───────────────────────────────────────────────────────────────
let searchTimer = null
function onKeywordInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    loadLogs()
  }, 400)
}

// ─── 筛选重置 ───────────────────────────────────────────────────────────────
function resetFilters() {
  filterType.value = ''
  filterKeyword.value = ''
  currentPage.value = 1
  loadLogs()
}

// ─── 分页操作 ───────────────────────────────────────────────────────────────
function goToPage(page) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  loadLogs()
  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function prevPage() {
  goToPage(currentPage.value - 1)
}

function nextPage() {
  goToPage(currentPage.value + 1)
}

// 页码按钮列表（智能展示）
const pageButtons = computed(() => {
  const totalP = totalPages.value
  const cur = currentPage.value
  if (totalP <= 7) {
    return Array.from({ length: totalP }, (_, i) => i + 1)
  }
  const pages = []
  if (cur <= 4) {
    pages.push(1, 2, 3, 4, 5, '...', totalP)
  } else if (cur >= totalP - 3) {
    pages.push(1, '...', totalP - 4, totalP - 3, totalP - 2, totalP - 1, totalP)
  } else {
    pages.push(1, '...', cur - 1, cur, cur + 1, '...', totalP)
  }
  return pages
})

// ─── 批量选择 ───────────────────────────────────────────────────────────────
function toggleSelectMode() {
  selectMode.value = !selectMode.value
  if (!selectMode.value) {
    selectedIds.value.clear()
  }
}

function toggleSelect(id) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
  selectedIds.value = new Set(selectedIds.value) // 触发响应式更新
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIds.value.clear()
  } else {
    logs.value.forEach(log => selectedIds.value.add(log.id))
  }
  selectedIds.value = new Set(selectedIds.value)
}

const isAllSelected = computed(() => {
  return logs.value.length > 0 && logs.value.every(log => selectedIds.value.has(log.id))
})

const selectedCount = computed(() => selectedIds.value.size)

async function batchDeleteLogs() {
  if (selectedIds.value.size === 0) {
    MyMessage.warning('请先选择要删除的日志')
    return
  }
  showDeleteModal.value = true
}

async function confirmBatchDelete() {
  // 先备份要删除的 IDs
    const idsToDelete = Array.from(selectedIds.value)
    const currentLogsCount = logs.value.length
    showDeleteModal.value = false

    if (idsToDelete.length === 0) return

    try {
      const { deleteLogs } = await import('../api/inventory.js')
      await deleteLogs({ ids: idsToDelete })

      selectMode.value = false
      selectedIds.value.clear()

      if (currentLogsCount === idsToDelete.length && currentPage.value > 1) {
        currentPage.value--
      }

      MyMessage.success(`已删除 ${idsToDelete.length} 条日志`)
      await loadLogs()
    } catch (e) {
      selectMode.value = false
      selectedIds.value.clear()
      MyMessage.error('批量删除失败：' + (e.response?.data?.error || '未知错误'))
    }
}

// ─── Excel 导出 ─────────────────────────────────────────────────────────────
const exporting = ref(false)

function handleExportClick() {
  showExportModal.value = true
}

// ─── 工具函数：通用样式定义 ────────────────────────────────────────────────────
function getStyleConfig() {
  const thin = { style: 'thin', color: { argb: 'FFB8BCC8' } }
  const thick = { style: 'medium', color: { argb: 'FF8B95A3' } }
  return {
    thinBorder: { top: thin, left: thin, bottom: thin, right: thin },
    thickBorder: { top: thick, left: thick, bottom: thick, right: thick },
    alignCenter: { horizontal: 'center', vertical: 'middle', wrapText: false },
    alignCenterWrap: { horizontal: 'center', vertical: 'middle', wrapText: true },
    alignLeft: { horizontal: 'left', vertical: 'middle', wrapText: true },
    // Indigo 配色（标题）
    titleBg: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } },
    titleFont: { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Microsoft YaHei' },
    // 表头样式
    headerBg: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } },
    headerFont: { bold: true, size: 11, color: { argb: 'FF3730A3' }, name: 'Microsoft YaHei' },
    // 数据行样式
    dataFont: { size: 10, color: { argb: 'FF1F2937' }, name: 'Microsoft YaHei' },
    zebraBg1: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
    zebraBg2: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } },
    // 总计行样式
    totalBg: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } },
    totalFont: { bold: true, size: 11, color: { argb: 'FF3730A3' }, name: 'Microsoft YaHei' },
    // 合并单元格背景（继承上层）
    mergeBg: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
  }
}

function applyCellStyle(cell, style) {
  cell.border = style.border
  cell.alignment = style.alignment
}

function applyTitleStyle(cell, cfg) {
  cell.fill = cfg.titleBg
  cell.font = cfg.titleFont
  cell.border = cfg.thickBorder
  cell.alignment = cfg.alignCenter
}

function applyHeaderStyle(cell, cfg) {
  cell.fill = cfg.headerBg
  cell.font = cfg.headerFont
  cell.border = cfg.thinBorder
  cell.alignment = cfg.alignCenter
}

function applyDataStyle(cell, isZebra, cfg) {
  cell.fill = isZebra ? cfg.zebraBg2 : cfg.zebraBg1
  cell.font = cfg.dataFont
  cell.border = cfg.thinBorder
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false }
}

function applyTotalStyle(cell, cfg) {
  cell.fill = cfg.totalBg
  cell.font = cfg.totalFont
  cell.border = cfg.thinBorder
  cell.alignment = cfg.alignCenter
}

// ─── Sheet 1：库存日志 ───────────────────────────────────────────────────────
async function createLogSheet(workbook, data, cfg) {
  const sheet = workbook.addWorksheet('库存日志', {
    views: [{ state: 'frozen', ySplit: 2 }],
  })

  // 设置 autoFilter（点击筛选）
  sheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: 10 },
  }

  // ── Row 1：空行（合并单元格区域外） ──
  const emptyRow = sheet.addRow([''])
  emptyRow.height = 6

  // ── Row 2：表头 ──
  const header = [
    '操作时间', '商品名称', 'SKU', '大类',
    '操作类型', '变动数量', '操作前', '操作后',
    '运单号', '备注',
  ]
  const headerRow = sheet.addRow(header)
  headerRow.height = 36
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    applyHeaderStyle(cell, cfg)
  })

  // ── 数据行：先反转（让最早的时间在上面） ──
  const reversedData = [...data].reverse()

  // 准备数据并按日期分组
  const dateGroups = []
  let currentDate = null
  let currentGroup = []

  reversedData.forEach(log => {
    const dateStr = formatDateOnly(log.created_at)
    if (dateStr !== currentDate) {
      if (currentGroup.length > 0) {
        dateGroups.push({ date: currentDate, logs: currentGroup })
      }
      currentDate = dateStr
      currentGroup = [log]
    } else {
      currentGroup.push(log)
    }
  })
  if (currentGroup.length > 0) {
    dateGroups.push({ date: currentDate, logs: currentGroup })
  }

  // 写入数据行（带日期合并）
  const startDataRow = 3
  let rowIdx = startDataRow

  dateGroups.forEach(group => {
    const groupSize = group.logs.length
    const firstRowOfGroup = rowIdx

    group.logs.forEach((log, idx) => {
      const rowVals = [
        formatDateOnly(log.created_at),
        log.product_name || '',
        log.sku_code || '',
        log.category_name || '',
        typeLabel(log.type),
        safeStock(log.quantity),
        safeStock(log.stock_before),
        safeStock(log.stock_after),
        log.tracking_number != null && log.tracking_number !== '' ? String(log.tracking_number) : '',
        log.note || '',
      ]

      const row = sheet.addRow(rowVals)
      row.height = 24
      const isZebra = (rowIdx - startDataRow) % 2 === 1

      row.eachCell({ includeEmpty: true }, (cell) => {
        applyDataStyle(cell, isZebra, cfg)
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false }
      })

      rowIdx++
    })

    // 合并日期列（如果当天有多条记录）
    if (groupSize > 1) {
      sheet.mergeCells(firstRowOfGroup, 1, firstRowOfGroup + groupSize - 1, 1)
      const mergedCell = sheet.getCell(firstRowOfGroup, 1)
      mergedCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false }
      applyDataStyle(mergedCell, false, cfg)
    }
  })

  // ── 列宽设置 ──
  const colWidths = [16, 24, 18, 12, 10, 10, 10, 10, 22, 36]
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w
  })
}

// ─── 工具函数：仅日期（无时分秒） ──────────────────────────────────────────
function formatDateOnly(t) {
  if (!t) return '-'
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(t).slice(0, 10) || '-'
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ─── Sheet N：大类库存明细 ────────────────────────────────────────────────────
async function createCategorySheet(workbook, category, products, logData, cfg) {
  // 筛选属于该大类的产品
  const catProducts = products.filter(p => p.category_id === category.id)

  // 准备字段顺序（使用 template_schema 前3个字段作为排序/合并依据）
  // 如果没有 template_schema 或为空，使用默认字段
  const rawSchema = category.template_schema || []
  const schemaFields = rawSchema.length > 0 ? rawSchema.slice(0, 3) : ['规格', '型号', 'LOG']

  // ── 准备数据：提取规格属性 ──
  const rowsData = []
  catProducts.forEach(product => {
    // 尝试从产品中解析规格属性
    let attrs = {}
    if (product.attributes) {
      try {
        attrs = typeof product.attributes === 'string'
          ? JSON.parse(product.attributes)
          : product.attributes
      } catch (e) {
        attrs = {}
      }
    }

    rowsData.push({
      product,
      attrs,
      // 排序用的字段（前3个规格字段的值）
      sortKeys: schemaFields.map(f => String(attrs[f] || '').trim()),
    })
  })

  // ── 排序：按前3个规格字段稳定排序 ──
  rowsData.sort((a, b) => {
    for (let i = 0; i < schemaFields.length; i++) {
      const keyA = a.sortKeys[i] || ''
      const keyB = b.sortKeys[i] || ''
      const cmp = keyA.localeCompare(keyB, 'zh-CN', { sensitivity: 'base' })
      if (cmp !== 0) return cmp
    }
    // 最后按 SKU 排序
    return String(a.product.sku_code || '').localeCompare(String(b.product.sku_code || ''), 'zh-CN')
  })

  // ── 构建表头 ──
  const headerLabels = [...schemaFields, 'SKU', '商品名称', '库存数量', '单价（元）', '金额（元）']

  // ── 获取 Sheet 名称（截断过长的大类名） ──
  const sheetName = (category.name || '未命名').length > 25
    ? (category.name || '未命名').slice(0, 22) + '...'
    : (category.name || '未命名')

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 3 }],
  })

  // 计算列索引（1-based）
  const skuColIdx = schemaFields.length + 1
  const nameColIdx = schemaFields.length + 2
  const qtyColIdx = schemaFields.length + 3
  const priceColIdx = schemaFields.length + 4
  const amountColIdx = schemaFields.length + 5
  const totalColCount = amountColIdx // 总列数

  // autoFilter（点击筛选）
  sheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: totalColCount },
  }

  // ── Row 1：标题行（合并整个表头区域） ──
  const priceVal = category.price != null && category.price !== '' && !isNaN(Number(category.price))
    ? '¥' + Number(category.price).toFixed(2)
    : '未设置'
  const titleText = `【${category.name}】库存明细  |  单价：${priceVal}`
  const titleRow = sheet.addRow([titleText])
  titleRow.height = 40
  // 合并所有列
  sheet.mergeCells(1, 1, 1, totalColCount)
  applyTitleStyle(sheet.getCell(1, 1), cfg)

  // ── Row 2：空行 ──
  const emptyRow = sheet.addRow([''])
  emptyRow.height = 6

  // ── Row 3：表头 ──
  const headerRow = sheet.addRow(headerLabels)
  headerRow.height = 36
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    applyHeaderStyle(cell, cfg)
  })

  // ── 数据行 + 合并逻辑 ──
  const startDataRow = 4
  const dataRowCount = rowsData.length

  if (dataRowCount > 0) {
    const numFields = schemaFields.length // 需要合并的父级字段数量

    rowsData.forEach((rowItem, idx) => {
      const product = rowItem.product
      const attrs = rowItem.attrs

      // 计算单价：优先使用产品单价，否则使用大类单价
      const prodPrice = product.cost_price != null && product.cost_price !== ''
        ? Number(product.cost_price) : null
      const catPrice = category.price != null && category.price !== ''
        ? Number(category.price) : null
      const unitPrice = prodPrice !== null && !isNaN(prodPrice) ? prodPrice
        : (catPrice !== null && !isNaN(catPrice) ? catPrice : 0)

      // 单价为0时显示0
      const displayPrice = unitPrice > 0 ? unitPrice : 0
      const stockQty = Number(product.current_stock) || 0

      // 构建行数据：[...规格字段, SKU, 名称, 数量, 单价, 金额公式占位]
      const rowVals = [
        ...schemaFields.map(f => String(attrs[f] || '').trim()),
        product.sku_code || '',
        product.name || '',
        stockQty,
        displayPrice,
        '' // 金额列占位（用于放公式）
      ]

      const rowNum = startDataRow + idx
      const row = sheet.addRow(rowVals)
      row.height = 22

      const isZebra = idx % 2 === 1

      // 应用样式
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        applyDataStyle(cell, isZebra, cfg)

        // SKU 列居中
        if (colNum === skuColIdx) {
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false }
        }
        // 数量、单价、数值列右��齐
        if (colNum >= nameColIdx) {
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false }
        }
      })

      // 设置金额列的公式（数量 * 单价）
      const qtyCellRef = `${String.fromCharCode(64 + qtyColIdx)}${rowNum}`
      const priceCellRef = `${String.fromCharCode(64 + priceColIdx)}${rowNum}`
      const amountCell = sheet.getCell(rowNum, amountColIdx)
      amountCell.value = { formula: `${qtyCellRef}*${priceCellRef}` }
      amountCell.numFmt = '¥#,##0.00'
      applyDataStyle(amountCell, isZebra, cfg)
      amountCell.border = cfg.thinBorder
      amountCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false }
    })

    // ── 单元格合并逻辑 ──
    for (let colIdx = 0; colIdx < numFields; colIdx++) {
      let mergeStartRow = startDataRow
      let mergeCount = 1
      let prevValue = rowsData.length > 0 ? (rowsData[0].sortKeys[colIdx] || '') : ''

      for (let rowIdx = 1; rowIdx < dataRowCount; rowIdx++) {
        const currentValue = rowsData[rowIdx].sortKeys[colIdx] || ''
        // 检查所有左侧字段是否相同
        const allLeftSame = rowsData[rowIdx].sortKeys
          .slice(0, colIdx + 1)
          .every((val, i) => (val || '') === (rowsData[rowIdx - 1].sortKeys[i] || ''))

        if (currentValue === prevValue && allLeftSame) {
          mergeCount++
        } else {
          if (mergeCount > 1) {
            sheet.mergeCells(mergeStartRow, colIdx + 1, mergeStartRow + mergeCount - 1, colIdx + 1)
            const mergedCell = sheet.getCell(mergeStartRow, colIdx + 1)
            mergedCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false }
          }
          mergeStartRow = startDataRow + rowIdx
          mergeCount = 1
          prevValue = currentValue
        }
      }

      // 处理最后一组合并
      if (mergeCount > 1) {
        sheet.mergeCells(mergeStartRow, colIdx + 1, mergeStartRow + mergeCount - 1, colIdx + 1)
        const mergedCell = sheet.getCell(mergeStartRow, colIdx + 1)
        mergedCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false }
      }
    }

    // ── 总计行 ──
    const totalRowNum = startDataRow + dataRowCount
    const totalRow = sheet.addRow(new Array(totalColCount).fill(''))
    totalRow.height = 32

    // 合并"合计"文字到前几列（SKU及之前的列）
    sheet.mergeCells(totalRowNum, 1, totalRowNum, skuColIdx)
    const labelCell = sheet.getCell(totalRowNum, 1)
    labelCell.value = '【合计】'
    applyTotalStyle(labelCell, cfg)

    // 商品名称列留空
    const nameCell = sheet.getCell(totalRowNum, nameColIdx)
    applyTotalStyle(nameCell, cfg)

    // 数量列：显示总计（如果SUM结果为0则显示"-"）
    const qtyColLetter = String.fromCharCode(64 + qtyColIdx)
    const qtyTotalCell = sheet.getCell(totalRowNum, qtyColIdx)
    qtyTotalCell.value = {
      formula: `SUM(${qtyColLetter}${startDataRow}:${qtyColLetter}${startDataRow + dataRowCount - 1})`,
      result: 0,
    }
    applyTotalStyle(qtyTotalCell, cfg)

    // 单价列：显示"-"（不累加单价）
    const priceCell = sheet.getCell(totalRowNum, priceColIdx)
    priceCell.value = '-'
    applyTotalStyle(priceCell, cfg)

    // 总金额公式
    const amountColLetter = String.fromCharCode(64 + amountColIdx)
    const totalAmountCell = sheet.getCell(totalRowNum, amountColIdx)
    totalAmountCell.value = {
      formula: `SUM(${amountColLetter}${startDataRow}:${amountColLetter}${startDataRow + dataRowCount - 1})`,
      result: 0,
    }
    totalAmountCell.numFmt = '¥#,##0.00'
    applyTotalStyle(totalAmountCell, cfg)
  }

  // ── 列宽设置 ──
  const colWidths = [
    ...schemaFields.map(() => 14),
    18, // SKU
    24, // 商品名称
    12, // 数量
    12, // 单价
    14, // 金额
  ]
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w
  })
}

// ─── 主导出函数 ──────────────────────────────────────────────────────────────
async function confirmExport() {
  showExportModal.value = false
  exporting.value = true

  try {
    // ── Step 1：获取全量数据 ──
    // 1.1 获取日志数据（当前筛选条件）
    const logParams = {}
    if (filterType.value) logParams.type = filterType.value
    if (filterKeyword.value.trim()) logParams.keyword = filterKeyword.value.trim()
    const logsRes = await getLogs(logParams)
    const logsData = logsRes.data.data || []

    if (logsData.length === 0) {
      MyMessage.warning('当前筛选条件下无数据可导出')
      exporting.value = false
      return
    }

    // 1.2 获取全部分类（用于获取大类顺序和模板）
    // 按 sort_order 升序排列，然后反转，实现倒序展示（产品大类第一个的放最后）
    const catsRes = await getCategories()
    const categoriesData = (catsRes.data.data || []).sort((a, b) => {
      // sort_order 相同时按 id 排序
      const orderA = a.sort_order ?? a.id ?? 0
      const orderB = b.sort_order ?? b.id ?? 0
      return orderA - orderB
    }).reverse() // 倒序排列

    // 1.3 获取全部产品（用于获取实时库存和单价）
    const prodsRes = await getProducts({})
    const productsData = prodsRes.data.data || []

    // ── Step 2：构建 Workbook ──
    const workbook = new ExcelJS.Workbook()
    workbook.creator = '档把库存系统'
    workbook.created = new Date()

    const cfg = getStyleConfig()

    // 2.1 创建库存日志 Sheet
    await createLogSheet(workbook, logsData, cfg)

    // 2.2 按大类顺序创建库存明细 Sheet（只创建有产品的大类）
    let categoryCount = 0
    for (const cat of categoriesData) {
      const catProducts = productsData.filter(p => p.category_id === cat.id)
      if (catProducts.length === 0) continue // 跳过无产品的大类

      await createCategorySheet(workbook, cat, productsData, logsData, cfg)
      categoryCount++
    }

    // ── Step 3：生成文件并下载 ──
    const dateStr = formatDateForFile(new Date())
    const fileName = `商品日志-${logsData.length}条日志-${categoryCount}个大类产品-${dateStr}.xlsx`

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)

    MyMessage.success(`导出成功！共 ${logsData.length} 条日志，${categoryCount} 个大类`)
  } catch (e) {
    MyMessage.error('导出失败：' + (e.message || '未知错误'))
  } finally {
    exporting.value = false
  }
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────
function formatDateForFile(date) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

function formatTime(t) {
  if (!t) return '-'
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(t).replace('T', ' ').slice(0, 19) || '-'
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatDate(t) {
  if (!t) return '-'
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(t).replace('T', ' ').slice(0, 16) || '-'
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function typeLabel(type) {
  if (type === 'in') return '入库'
  if (type === 'out') return '出库'
  if (type === 'adjust') return '调整'
  if (type === 'add') return '新增'
  return type || '-'
}

function typeClass(type) {
  if (type === 'in') return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
  if (type === 'out') return 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
  if (type === 'adjust') return 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
  if (type === 'add') return 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20'
  return 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5'
}

function typeDotClass(type) {
  if (type === 'in') return 'bg-emerald-500'
  if (type === 'out') return 'bg-rose-500'
  if (type === 'adjust') return 'bg-amber-500'
  if (type === 'add') return 'bg-sky-500'
  return 'bg-slate-400'
}

function safeStock(val) {
  const n = Number(val)
  return isNaN(n) ? 0 : n
}

onMounted(loadLogs)
</script>

<template>
  <div class="h-full overflow-auto">
    <!-- 页面标题 -->
    <div class="sticky top-0 z-20 px-4 lg:px-6 py-4 lg:py-5
                 bg-slate-50/80 dark:bg-slate-950/80
                 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/5 pb-safe">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">库存日志</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">记录所有库存变动历史</p>
        </div>

        <!-- 操作按钮组 -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- 导出按钮 -->
          <button
            @click="handleExportClick"
            :disabled="exporting"
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                   bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500
                   text-white shadow-sm
                   disabled:opacity-50 disabled:cursor-not-allowed
                   active:scale-95 transition-all duration-200 cursor-pointer"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0-3-3m3 3 3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            {{ exporting ? '导出中…' : '导出记录' }}
          </button>

          <!-- 批量选择开关 -->
          <button
            @click="toggleSelectMode"
            :class="[
              selectMode
                ? 'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-violet-500 hover:bg-violet-600 dark:bg-violet-600 dark:hover:bg-violet-500 text-white border-transparent transition-all duration-200 cursor-pointer'
                : 'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-200 cursor-pointer'
            ]"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {{ selectMode ? '取消选择' : '批量选择' }}
          </button>

          <!-- 刷新 -->
          <button
            @click="loadLogs"
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                   bg-white dark:bg-slate-800
                   border border-slate-200 dark:border-white/10
                   text-slate-600 dark:text-slate-400
                   hover:bg-slate-50 dark:hover:bg-white/5
                   active:scale-95 transition-all duration-200 cursor-pointer"
          >
            <svg class="w-4 h-4" :class="loading ? 'animate-spin' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            刷新
          </button>
        </div>
      </div>

      <!-- 筛选栏 -->
      <div class="mt-4">
        <!-- 手机端：一行布局（筛选图标 + 搜索） -->
        <div class="flex lg:hidden items-center gap-2">
          <MyFilterSelect
            v-model="filterType"
            :options="typeOptions"
            placeholder="操作类型"
            @change="() => { currentPage = 1; loadLogs(); }"
            :compact="true"
          />
          <div class="flex-1 min-w-0 h-10">
            <MyFilterSearch
              v-model="filterKeyword"
              placeholder="搜索商品名称 / SKU / 运单号"
              @search="onKeywordInput"
            />
          </div>
        </div>

        <!-- PC端：原有布局（筛选 + 搜索 + 重置） -->
        <div class="hidden lg:flex items-stretch gap-2 lg:gap-3">
          <MyFilterSelect
            v-model="filterType"
            :options="typeOptions"
            placeholder="操作类型"
            @change="() => { currentPage = 1; loadLogs(); }"
          />
          <div class="flex-1 min-w-0">
            <MyFilterSearch
              v-model="filterKeyword"
              placeholder="搜索商品名称 / SKU / 运单号"
              @search="onKeywordInput"
            />
          </div>
          <!-- 重置按钮 -->
          <button
            v-if="filterType || filterKeyword"
            @click="resetFilters"
            class="shrink-0 h-10 px-4 text-sm font-medium rounded-xl border-2 transition-all duration-200 cursor-pointer
                   text-[var(--filter-accent)] border-[var(--filter-accent)] hover:bg-[var(--filter-bg)]"
          >
            重置
          </button>
        </div>
      </div>
    </div>

    <!-- 日志列表内容 -->
    <div class="px-3 sm:px-4 lg:px-6 py-4 lg:py-5">

      <!-- 批量操作栏 -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div
          v-if="selectMode && selectedCount > 0"
          class="mb-3 md:mb-4 flex items-center justify-between gap-3 p-3 lg:p-4 rounded-xl
                 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20"
        >
          <div class="flex items-center gap-2 text-sm text-violet-700 dark:text-violet-300">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span class="font-medium">已选择 {{ selectedCount }} 条记录</span>
          </div>
          <button
            @click="batchDeleteLogs"
            class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                   bg-rose-500 hover:bg-rose-600 text-white
                   active:scale-95 transition-all duration-200 cursor-pointer"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            删除选中
          </button>
        </div>
      </Transition>

      <!-- 错误 -->
      <div
        v-if="error"
        class="mb-4 flex items-center gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20"
      >
        <div class="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
          </svg>
        </div>
        <p class="text-sm text-rose-600 dark:text-rose-300 flex-1">{{ error }}</p>
        <button @click="error = ''; loadLogs()" class="text-xs px-3 py-1.5 rounded-lg bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-500/30 cursor-pointer">重试</button>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="flex justify-center py-20">
        <div class="flex flex-col items-center gap-4">
          <div class="w-10 h-10 border-3 border-slate-200 dark:border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
          <span class="text-sm text-slate-500 dark:text-slate-400">加载中…</span>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="logs.length === 0" class="flex flex-col items-center justify-center py-20">
        <div class="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>
          </svg>
        </div>
        <p class="text-base font-semibold text-slate-600 dark:text-slate-300">暂无库存日志</p>
        <p class="text-sm text-slate-400 dark:text-slate-500 mt-1">入库、出库或调整操作后会产生日志</p>
      </div>

      <!-- 有数据：PC 表格 (>= lg) -->
      <div v-else-if="logs.length > 0" class="hidden lg:block">
        <div class="rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full text-sm min-w-[900px]">
              <thead>
              <tr class="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-white/5">
                <!-- 选择列 -->
                <th v-if="selectMode" class="w-10 px-5 py-3.5 text-left">
                  <label class="custom-checkbox">
                    <input
                      type="checkbox"
                      :checked="isAllSelected"
                      @change="toggleSelectAll"
                    />
                    <span class="checkmark"></span>
                  </label>
                </th>
                <th class="px-5 py-3.5 text-left font-medium whitespace-nowrap">操作时间</th>
                <th class="px-5 py-3.5 text-left font-medium">商品名称</th>
                <th class="px-5 py-3.5 text-center font-medium">大类</th>
                <th class="px-5 py-3.5 text-center font-medium">类型</th>
                <th class="px-5 py-3.5 text-center font-medium">变动数量</th>
                <th class="px-5 py-3.5 text-center font-medium">操作前</th>
                <th class="px-5 py-3.5 text-center font-medium">操作后</th>
                <th class="px-5 py-3.5 text-left font-medium">运单号</th>
                <th class="px-5 py-3.5 text-left font-medium pr-5">备注</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50 dark:divide-white/5">
              <tr
                v-for="log in logs"
                :key="log.id"
                :class="[
                  'hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors',
                  selectMode && selectedIds.has(log.id) ? 'bg-violet-50/50 dark:bg-violet-500/5' : ''
                ]"
              >
                <!-- 复选框 -->
                <td v-if="selectMode" class="px-5 py-3.5">
                  <label class="custom-checkbox">
                    <input
                      type="checkbox"
                      :checked="selectedIds.has(log.id)"
                      @change="toggleSelect(log.id)"
                    />
                    <span class="checkmark"></span>
                  </label>
                </td>
                <td class="px-5 py-3.5 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap font-mono">
                  {{ formatTime(log.created_at) }}
                </td>
                <td class="px-5 py-3.5 text-sm font-medium text-slate-900 dark:text-white">
                  {{ log.product_name || '-' }}
                </td>
                <td class="px-5 py-3.5 text-center">
                  <span v-if="log.category_name" class="inline-flex px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5">
                    {{ log.category_name }}
                  </span>
                  <span v-else class="text-xs text-slate-400 dark:text-slate-500">-</span>
                </td>
                <td class="px-5 py-3.5 text-center">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg" :class="typeClass(log.type)">
                    <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="typeDotClass(log.type)"></span>
                    {{ typeLabel(log.type) }}
                  </span>
                </td>
                <td class="px-5 py-3.5 text-center">
                  <span
                    class="text-sm font-bold tabular-nums"
                    :class="log.type === 'in' || log.type === 'add' ? 'text-emerald-500' : (log.type === 'out' ? 'text-rose-500' : 'text-amber-500')"
                  >
                    {{ log.type === 'in' || log.type === 'add' ? '+' : (log.type === 'out' ? '-' : '') }}{{ safeStock(log.quantity) }}
                  </span>
                </td>
                <td class="px-5 py-3.5 text-center text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                  {{ safeStock(log.stock_before) }}
                </td>
                <td class="px-5 py-3.5 text-center text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                  {{ safeStock(log.stock_after) }}
                </td>
                <td class="px-5 py-3.5">
                  <span
                    v-if="log.tracking_number"
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>
                    </svg>
                    {{ log.tracking_number }}
                  </span>
                  <span v-else class="text-xs text-slate-400 dark:text-slate-500">-</span>
                </td>
                <td class="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 max-w-[200px] truncate pr-5">
                  {{ log.note || '-' }}
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <!-- 有数据：平板/手机卡片列表 (< lg) -->
      <div v-if="!loading && logs.length > 0" class="lg:hidden space-y-3 px-3 sm:px-4">
        <div
          v-for="log in logs"
          :key="log.id"
          :class="[
            'rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm',
            selectMode && selectedIds.has(log.id) ? 'border-violet-300 dark:border-violet-500/30' : ''
          ]"
        >
          <!-- 顶部栏：选择 + 时间 + 类型 -->
          <div class="px-3 pt-2.5 pb-2 flex items-center justify-between gap-2">
            <!-- 移动端复选框 -->
            <div v-if="selectMode" class="flex items-center shrink-0">
              <label class="custom-checkbox">
                <input
                  type="checkbox"
                  :checked="selectedIds.has(log.id)"
                  @change="toggleSelect(log.id)"
                />
                <span class="checkmark"></span>
              </label>
            </div>
            <span class="text-[11px] text-slate-400 dark:text-slate-500 font-mono whitespace-nowrap">{{ formatDate(log.created_at) }}</span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded shrink-0" :class="typeClass(log.type)">
              <span class="w-1 h-1 rounded-full shrink-0" :class="typeDotClass(log.type)"></span>
              {{ typeLabel(log.type) }}
            </span>
          </div>

          <!-- 商品名称 -->
          <div class="px-3 pb-2">
            <p class="text-sm font-bold text-slate-900 dark:text-white leading-snug mb-2">{{ log.product_name || '-' }}</p>

            <!-- 核心数据网格 - 紧凑 -->
            <div class="flex items-center justify-between gap-1.5 py-1.5 px-2 rounded-lg" style="background: var(--bg-secondary);">
              <!-- 变动数量 -->
              <div class="text-center flex-1">
                <p class="text-[15px] font-bold leading-none" :class="log.type === 'in' || log.type === 'add' ? 'text-emerald-500' : (log.type === 'out' ? 'text-rose-500' : 'text-amber-500')">
                  {{ log.type === 'in' || log.type === 'add' ? '+' : (log.type === 'out' ? '-' : '') }}{{ safeStock(log.quantity) }}
                </p>
                <p class="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">变动</p>
              </div>
              <div class="w-px h-7" style="background: var(--border-default);"></div>
              <!-- 操作前 -->
              <div class="text-center flex-1">
                <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-none tabular-nums">{{ safeStock(log.stock_before) }}</p>
                <p class="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">前</p>
              </div>
              <div class="w-px h-7" style="background: var(--border-default);"></div>
              <!-- 操作后 -->
              <div class="text-center flex-1">
                <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-none tabular-nums">{{ safeStock(log.stock_after) }}</p>
                <p class="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">后</p>
              </div>
            </div>
          </div>

          <!-- 附加信息 -->
          <div v-if="log.category_name || log.tracking_number || log.note" class="px-3 pb-2.5 flex items-center justify-between gap-1.5">
            <!-- 左侧：运单号 + 大类（右对齐组） -->
            <div class="flex items-center gap-1.5 shrink-0">
              <span v-if="log.tracking_number" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded font-mono bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>
                </svg>
                {{ log.tracking_number }}
              </span>
              <span v-if="log.category_name" class="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                {{ log.category_name }}
              </span>
            </div>
            <!-- 右侧：备注（占据剩余空间，左对齐） -->
            <span v-if="log.note" class="text-[11px] text-slate-500 dark:text-slate-400 truncate text-right min-w-0">{{ log.note }}</span>
          </div>
        </div>
      </div>

      <!-- 分页器（手机一行显示，PC三列布局） -->
      <div
        v-if="!loading && logs.length > 0"
        class="mt-4 md:mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 md:gap-4"
        style="min-height: 0;"
      >
        <!-- 手机端一行：左右分散布局 -->
        <div class="flex sm:hidden items-center justify-between w-full text-xs text-slate-500 dark:text-slate-400 px-1">
          <!-- 左侧：总数 -->
          <span>共 <span class="font-medium text-slate-700 dark:text-slate-200">{{ total }}</span> 条</span>

          <!-- 中间：页码按钮组 -->
          <div class="flex items-center gap-1">
            <button
              @click="prevPage"
              :disabled="currentPage === 1"
              class="flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 19-7-7 7-7"/>
              </svg>
            </button>
            <span class="min-w-[3rem] text-center font-medium text-slate-700 dark:text-slate-200">{{ currentPage }}/{{ totalPages }}</span>
            <button
              @click="nextPage"
              :disabled="currentPage === totalPages || totalPages === 0"
              class="flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7"/>
              </svg>
            </button>
          </div>

          <!-- 右侧：每页条数 -->
          <div ref="pageSizeRootRef" class="relative">
            <button
              type="button"
              class="page-size-trigger flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-medium tabular-nums transition-all duration-200 cursor-pointer"
              :style="pageSizeOpen
                ? 'border-color: var(--filter-accent); color: var(--filter-accent);'
                : 'color: var(--text-secondary);'"
              @click="togglePageSizeOpen"
            >
              {{ pageSize }}
              <svg class="h-3 w-3 shrink-0 transition-transform duration-200" :class="pageSizeOpen ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
              </svg>
            </button>
            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 translate-y-1"
            >
              <div
                v-if="pageSizeOpen"
                class="page-size-panel absolute z-[60] mb-2 right-0 min-w-[4.5rem] overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--modal-bg)] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
                style="bottom: 100%;"
              >
                <button
                  v-for="n in pageSizeOptions"
                  :key="n"
                  type="button"
                  class="flex w-full items-center justify-center px-3 py-2 text-xs transition-colors duration-100 cursor-pointer"
                  :class="pageSize === n
                    ? 'bg-[var(--filter-bg)] font-medium text-[var(--filter-accent)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'"
                  @click="pickPageSize(n)"
                >
                  {{ n }}
                </button>
              </div>
            </Transition>
          </div>
        </div>

        <!-- PC端：左侧总数 + 每页条数 -->
        <div class="hidden sm:flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 shrink-0">
          <span class="whitespace-nowrap">共 <span class="font-semibold text-slate-700 dark:text-slate-200">{{ total }}</span> 条</span>
          <div class="flex items-center gap-2">
            <span class="whitespace-nowrap">每页</span>
            <div ref="pageSizeRootRef" class="relative shrink-0">
              <button
                type="button"
                class="page-size-trigger flex items-center gap-1.5 rounded-lg border bg-[var(--input-bg)] px-2.5 py-1 text-xs font-medium tabular-nums transition-all duration-200 cursor-pointer"
                :style="pageSizeOpen
                  ? 'border-color: var(--filter-accent); color: var(--filter-accent); box-shadow: 0 0 0 3px var(--filter-glow);'
                  : 'border-color: var(--input-border); color: var(--text-secondary);'"
                @click="togglePageSizeOpen"
              >
                {{ pageSize }}
                <svg
                  class="h-3.5 w-3.5 shrink-0 transition-transform duration-200"
                  :class="pageSizeOpen ? 'rotate-180' : ''"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
                </svg>
              </button>
              <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="opacity-0 translate-y-1"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 translate-y-1"
              >
                <div
                  v-if="pageSizeOpen"
                  class="page-size-panel absolute z-[60] mb-2 w-full min-w-[4.5rem] overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--modal-bg)] py-1 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
                  style="bottom: 100%; left: 0;"
                >
                  <button
                    v-for="n in pageSizeOptions"
                    :key="n"
                    type="button"
                    class="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors duration-100 cursor-pointer"
                    :class="pageSize === n
                      ? 'bg-[var(--filter-bg)] font-medium text-[var(--filter-accent)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'"
                    @click="pickPageSize(n)"
                  >
                    <span class="tabular-nums">{{ n }}</span>
                    <svg
                      v-if="pageSize === n"
                      class="h-4 w-4 shrink-0 text-[var(--filter-accent)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                    </svg>
                  </button>
                </div>
              </Transition>
            </div>
            <span class="whitespace-nowrap">条</span>
          </div>
        </div>

        <!-- PC端：中间页码按钮 -->
        <div class="hidden sm:flex items-center justify-center gap-1 sm:gap-1.5 overflow-x-auto scroll-touch max-w-full">
          <!-- 上一页 -->
          <button
            @click="prevPage"
            :disabled="currentPage === 1"
            class="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs sm:text-sm font-medium
                   border border-slate-200 dark:border-white/10
                   text-slate-500 dark:text-slate-400
                   disabled:opacity-40 disabled:cursor-not-allowed
                   hover:bg-slate-50 dark:hover:bg-white/5
                   active:scale-95 transition-all duration-150 cursor-pointer shrink-0"
          >
            <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 19-7-7 7-7"/>
            </svg>
          </button>

          <!-- 页码信息 -->
          <span class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap px-1">
            第 <span class="font-medium text-slate-700 dark:text-slate-200">{{ currentPage }}</span> / {{ totalPages }} 页
          </span>

          <!-- 下一页 -->
          <button
            @click="nextPage"
            :disabled="currentPage === totalPages || totalPages === 0"
            class="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs sm:text-sm font-medium
                   border border-slate-200 dark:border-white/10
                   text-slate-500 dark:text-slate-400
                   disabled:opacity-40 disabled:cursor-not-allowed
                   hover:bg-slate-50 dark:hover:bg-white/5
                   active:scale-95 transition-all duration-150 cursor-pointer shrink-0"
          >
            <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7"/>
            </svg>
          </button>
        </div>

        <!-- PC端：右侧跳转 -->
        <div class="hidden sm:flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 shrink-0">
          <label class="whitespace-nowrap">第</label>
          <input
            type="number"
            :value="currentPage"
            @change="(e) => {
              const val = parseInt(e.target.value)
              if (!isNaN(val) && val >= 1 && val <= totalPages) goToPage(val)
              else e.target.value = currentPage
            }"
            min="1"
            :max="totalPages"
            class="w-14 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300 text-center focus:outline-none focus:border-indigo-500"
          />
          <label class="whitespace-nowrap">页</label>
        </div>
      </div>

      <!-- 导出确认弹窗 -->
      <Transition name="modal-fade">
        <div v-if="showExportModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showExportModal = false"></div>
          <div
            class="relative w-full max-w-sm rounded-2xl overflow-hidden scale-in
                   bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-xl"
          >
            <div class="p-6">
              <div class="flex items-start gap-4">
                <div class="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
                  <svg class="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0-3-3m3 3 3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <div class="flex-1">
                  <h3 class="text-base font-bold text-slate-900 dark:text-white">确认导出</h3>
                  <p class="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                    确定要导出所有操作日志吗？<br/>
                    <span class="text-xs text-slate-400 dark:text-slate-500">导出的数据将包含当前筛选条件下的所有记录。</span>
                  </p>
                </div>
              </div>
            </div>
            <div class="px-6 pb-6 flex items-center gap-3 pb-safe">
              <button @click="showExportModal = false" class="flex-1 py-2.5 text-sm font-medium rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer">
                取消
              </button>
              <button @click="confirmExport" class="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-md shadow-indigo-500/20 hover:from-indigo-600 hover:to-indigo-700 active:scale-95 transition-all cursor-pointer">
                确认导出
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- 删除确认弹窗 -->
      <MyModal
        v-model="showDeleteModal"
        title="确认删除"
        width="max-w-md"
      >
        <template #icon>
          <div class="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
        </template>
        <div class="text-sm text-[var(--text-secondary)] leading-relaxed">
          <p>确定要删除选中的 <span class="font-bold text-rose-500">{{ selectedCount }}</span> 条日志吗？</p>
          <p class="mt-2 text-rose-400 text-xs">此操作不可恢复，请谨慎操作。</p>
        </div>
        <template #footer>
          <button
            @click="showDeleteModal = false"
            class="px-4 py-2.5 text-sm font-medium rounded-xl border cursor-pointer active:scale-95 transition-all"
            style="background-color: var(--bg-tertiary); color: var(--text-secondary); border-color: var(--border-default);"
          >
            取消
          </button>
          <button
            @click="confirmBatchDelete"
            class="px-5 py-2.5 text-sm font-bold text-white rounded-xl border border-transparent active:scale-95 transition-all cursor-pointer bg-rose-500 hover:bg-rose-600"
          >
            确认删除
          </button>
        </template>
      </MyModal>

    </div>
  </div>
</template>

<style scoped>
/* 自定义复选框样式 */
.custom-checkbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  user-select: none;
}

.custom-checkbox input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.custom-checkbox .checkmark {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 2px solid var(--border-strong);
  background-color: var(--input-bg);
  transition: all 0.15s ease;
  position: relative;
}

.custom-checkbox input:checked + .checkmark {
  background-color: var(--filter-accent);
  border-color: var(--filter-accent);
}

.custom-checkbox .checkmark::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 5px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) scale(0);
  transition: transform 0.15s ease;
}

.custom-checkbox input:checked + .checkmark::after {
  transform: rotate(45deg) scale(1);
}

.custom-checkbox:hover .checkmark {
  border-color: var(--filter-accent);
}

.custom-checkbox input:focus-visible + .checkmark {
  box-shadow: 0 0 0 3px var(--filter-glow);
}
</style>
