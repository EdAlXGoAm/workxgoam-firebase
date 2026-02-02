import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, AfterViewChecked, ChangeDetectorRef, ViewChild, ElementRef, Renderer2, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Task, TaskAction } from '../../models/task.model';
import { Project } from '../../models/project.model';
import { Environment } from '../../models/environment.model';
import { TaskType } from '../../models/task-type.model';
import { MuiTimePickerComponent } from '../mui-time-picker/mui-time-picker.component';
import { PrioritySelectorComponent } from '../priority-selector/priority-selector.component';
import { AndroidDatePickerComponent } from '../android-date-picker/android-date-picker.component';
import { CustomSelectComponent, SelectOption } from '../custom-select/custom-select.component';
import { TaskTypeService } from '../../services/task-type.service';
import { TaskService } from '../../services/task.service';
import { TaskGroupSelectComponent } from '../task-group-select/task-group-select.component';
import { TaskGroupService } from '../../services/task-group.service';
import { TaskGroup } from '../../models/task-group.model';

@Component({
  selector: 'app-task-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MuiTimePickerComponent, PrioritySelectorComponent, AndroidDatePickerComponent, CustomSelectComponent, TaskGroupSelectComponent],
  templateUrl: './task-modal.component.html',
  styleUrls: ['./task-modal.component.css']
})
export class TaskModalComponent implements OnInit, OnDestroy, OnChanges, AfterViewChecked {
  @Input() showModal = false;
  @Input() task: Partial<Task> = {};
  @Input() isEditing = false;
  @Input() environments: Environment[] = [];
  @Input() projects: Project[] = [];
  @Input() allTasks: Task[] = []; // Todas las tareas del usuario para busqueda local
  @Input() allTaskTypes: TaskType[] = []; // Todos los tipos de tarea para evitar carga de Firestore
  @Input() allTaskGroups: TaskGroup[] = []; // Todos los grupos de tarea para evitar carga de Firestore
  
  @Output() closeModalEvent = new EventEmitter<void>();
  @Output() saveTaskEvent = new EventEmitter<Partial<Task>>();
  @Output() openEnvironmentModal = new EventEmitter<void>();
  @Output() openProjectModal = new EventEmitter<void>();
  @Output() openTaskTypeModal = new EventEmitter<void>();
  @Output() openRemindersModal = new EventEmitter<void>();
  @Output() openCalculatorModal = new EventEmitter<{type: 'start' | 'end'}>();
  
  // Date/time fields
  startDate = '';
  startTime = '';
  endDate = '';
  endTime = '';
  deadlineDate = '';
  deadlineTime = '';
  
  // UI state
  showEmojiPicker = false;
  showDeadlineSection = false;
  dateError = '';
  selectableProjects: Project[] = [];
  taskTypes: TaskType[] = [];
  selectableTaskTypes: TaskType[] = [];
  taskGroups: TaskGroup[] = [];
  isLoading = false;
  isLoadingTaskTypes = false;
  isSaving = false;
  
  // Tab activo para Descripción/Acciones
  activeDetailTab: 'description' | 'actions' = 'description';
  
  // Referencias para el selector de emojis
  @ViewChild('emojiButton', { static: false }) emojiButton!: ElementRef;
  
  // Referencia al selector de proyecto para abrirlo programáticamente
  @ViewChild('projectSelect', { static: false }) projectSelect!: CustomSelectComponent;
  @ViewChild('environmentSelect', { static: false }) environmentSelect!: CustomSelectComponent;
  @ViewChild('taskTypeSelect', { static: false }) taskTypeSelect!: CustomSelectComponent;
  private emojiPickerElement: HTMLElement | null = null;
  private emojiPickerClickListener?: () => void;
  private emojiGridElement: HTMLElement | null = null;
  private emojiHeaderElement: HTMLElement | null = null;
  
  // Tareas recientes del proyecto
  recentTasks: Task[] = [];
  showRecentTasksSelector = false;
  showRecentTasksModal = false;
  selectedRecentTaskIndex: string = '';
  recentTasksOptions: SelectOption[] = [];
  
  // Opciones para selectores personalizados
  environmentOptions: SelectOption[] = [];
  projectOptions: SelectOption[] = [];
  taskTypeOptions: SelectOption[] = [];
  
  // Modal de confirmación de duración
  showDurationConfirmModal = false;
  pendingStartDate = '';
  pendingStartTime = '';
  calculatedEndDate = '';
  calculatedEndTime = '';
  previousStartDate = '';
  previousStartTime = '';
  
  // Modal de confirmación de duración para fragmentos
  showFragmentDurationConfirmModal = false;
  pendingFragmentIndex: number | null = null;
  pendingFragmentStartDate = '';
  pendingFragmentStartTime = '';
  calculatedFragmentEndDate = '';
  calculatedFragmentEndTime = '';
  previousFragmentStartDate = '';
  previousFragmentStartTime = '';
  
  // Flag para evitar recursión infinita en sincronización
  private isSyncingFragment = false;
  
  // Fechas originales para calcular el desplazamiento de recordatorios
  originalStartDateTime: Date | null = null;
  originalEndDateTime: Date | null = null;
  
  // Subject para debounce de cambios en duración
  private durationChangeSubject = new Subject<number>();
  private durationChangeSubscription: any;
  
  // Emojis frecuentes (se mantienen al inicio)
  frequentEmojis = ['📝', '⏰', '✅', '🛏️', '🍔', 
                     '😀', '😊', '😎', '🤩', '😍', '🤔', '😴', '🥳', '😇', '🤯', 
                     '📅', '📌', '🔑', '📚', '💻', '📱', '🔋',
                     '🏋️', '🚴', '🚗', '🍎', '🍕', '🛒', '☕', '🍷', '🎵', '🎮', '🎨', '✈️'];
  
  // Categorías de emojis
  emojiCategories: { name: string; icon: string; emojis: string[] }[] = [
    {
      name: 'Frecuentes',
      icon: '⭐',
      emojis: ['📝', '⏰', '✅', '🛏️', '🍔', 
               '😀', '😊', '😎', '🤩', '😍', '🤔', '😴', '🥳', '😇', '🤯', 
               '📅', '📌', '🔑', '📚', '💻', '📱', '🔋',
               '🏋️', '🚴', '🚗', '🍎', '🍕', '🛒', '☕', '🍷', '🎵', '🎮', '🎨', '✈️']
    },
    {
      name: 'Sonrisas y Emociones',
      icon: '😀',
      emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😶‍🌫️', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '😵‍💫', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕']
    },
    {
      name: 'Gestos y Personas',
      icon: '👋',
      emojis: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '👶', '👧', '🧒', '👦', '👩', '🧑', '👨', '👩‍🦱', '👨‍🦱', '👩‍🦰', '👨‍🦰', '👱‍♀️', '👱‍♂️', '👩‍🦳', '👨‍🦳', '👩‍🦲', '👨‍🦲', '🧓', '👴', '👵', '🙍', '🙎', '🙅', '🙆', '💁', '🙋', '🧏', '🙇', '🤦', '🤦‍♂️', '🤦‍♀️', '🤷', '🤷‍♂️', '🤷‍♀️', '👮', '👮‍♂️', '👮‍♀️', '🕵', '🕵‍♂️', '🕵‍♀️', '💂', '🥷', '👷', '👷‍♂️', '👷‍♀️', '🤴', '👸', '👳', '👳‍♂️', '👳‍♀️', '👲', '🧕', '🤵', '🤵‍♂️', '🤵‍♀️', '👰', '🤰', '🤱', '👼', '🎅', '🤶', '🦸', '🦸‍♂️', '🦸‍♀️', '🦹', '🦹‍♂️', '🦹‍♀️', '🧙', '🧙‍♂️', '🧙‍♀️', '🧚', '🧚‍♂️', '🧚‍♀️', '🧛', '🧛‍♂️', '🧛‍♀️', '🧜', '🧜‍♂️', '🧜‍♀️', '🧝', '🧝‍♂️', '🧝‍♀️', '🧞', '🧞‍♂️', '🧞‍♀️', '🧟', '🧟‍♂️', '🧟‍♀️', '💆', '💇', '🚶', '🚶‍♂️', '🚶‍♀️', '🧍', '🧍‍♂️', '🧍‍♀️', '🧎', '🧎‍♂️', '🧎‍♀️', '🏃', '🏃‍♂️', '🏃‍♀️', '💃', '🕺', '🕴', '👯', '👯‍♂️', '👯‍♀️', '🧖', '🧖‍♂️', '🧖‍♀️', '🧗', '🧗‍♂️', '🧗‍♀️', '🤺', '🏇', '⛷️', '🏂', '🏌️', '🏌️‍♂️', '🏌️‍♀️', '🏄', '🏄‍♂️', '🏄‍♀️', '🚣', '🚣‍♂️', '🚣‍♀️', '🏊', '🏊‍♂️', '🏊‍♀️', '⛹️', '⛹️‍♂️', '⛹️‍♀️', '🏋️', '🏋️‍♂️', '🏋️‍♀️', '🚴', '🚴‍♂️', '🚴‍♀️', '🚵', '🚵‍♂️', '🚵‍♀️', '🤸', '🤸‍♂️', '🤸‍♀️', '🤼', '🤼‍♂️', '🤼‍♀️', '🤽', '🤽‍♂️', '🤽‍♀️', '🤾', '🤾‍♂️', '🤾‍♀️', '🤹', '🤹‍♂️', '🤹‍♀️', '🧘', '🧘‍♂️', '🧘‍♀️']
    },
    {
      name: 'Animales y Naturaleza',
      icon: '🐶',
      emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦡', '🐾', '🐕', '🐩', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔', '🌍', '🌎', '🌏', '🌋', '🗻', '🏔️', '⛰️', '🏕️', '🏖️', '🏜️', '🏝️', '🏞️', '🏟️', '🏛️', '🏗️', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃']
    },
    {
      name: 'Comida y Bebida',
      icon: '🍎',
      emojis: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊']
    },
    {
      name: 'Actividades y Deportes',
      icon: '⚽',
      emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🥅', '🏒', '🏑', '🥍', '🏏', '🥃', '⛳', '🏹', '🎣', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🏋️', '🤼', '🤸', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🚣', '🧗', '🚵', '🚴', '🏃', '🚶', '🎯', '🎮', '🕹️', '🎰', '🎲', '🃏', '🀄', '🎴', '🎭', '🖼️', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻', '🎲', '🎳', '🎯', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻', '🎤', '🎧', '🎼', '🎹', '🎷', '🎺', '🎸', '🎻']
    },
    {
      name: 'Viajes y Lugares',
      icon: '🚗',
      emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🚁', '🚟', '🚠', '🚡', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽', '🚧', '🚦', '🚥', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🕍', '🛕', '🕋', '⛩️', '🛤️', '🛣️', '🗾', '🎑', '🏞️', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇', '🌆', '🏙️', '🌃', '🌌', '🌉', '🌁']
    },
    {
      name: 'Objetos',
      icon: '⌚',
      emojis: ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💶', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🪠', '🧺', '🧻', '🚽', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🪣', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞', '🪟', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🪡', '🧵', '🪢', '👓', '🕶️', '🥽', '🥼', '🦺', '👔', '👕', '👖', '🩱', '🩲', '🩳', '👗', '👘', '🥻', '🩴', '👠', '👡', '👢', '👞', '👟', '🥾', '🥿', '🧦', '🧤', '🧣', '🎩', '🧢', '👒', '🎓', '⛑️', '🪖', '💄', '💍', '💼', '👜', '👝', '👛', '🛍️', '🎒', '🩴', '👡', '👠', '🪖', '🧳', '🌂', '☂️', '🧵', '🪡', '🪢', '🧶', '🧥', '🥼', '🦺', '👚', '👕', '👖', '🩲', '🩳', '👔', '👗', '👙', '👘', '🥻', '🩱', '👚', '👕', '👖', '🩲', '🩳', '👔', '👗', '👙', '👘', '🥻', '🩱', '🧦', '🧤', '🧣', '🧥', '🥼', '🦺', '👔', '👕', '👖', '🩲', '🩳', '👔', '👗', '👙', '👘', '🥻', '🩱', '🧥', '🥼', '🦺', '🧦', '🧤', '🧣', '🧥', '🥼', '🦺']
    },
    {
      name: 'Símbolos',
      icon: '❤️',
      emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❓', '❕', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', '🔤', '🔠', '🔡', '🔢', '🔟', '🔠', '🔡', '🔢', '🔟', '#️⃣', '*️⃣', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⬛', '⬜', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧']
    },
    {
      name: 'Banderas',
      icon: '🏳️',
      emojis: ['🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇨', '🇦🇩', '🇦🇪', '🇦🇫', '🇦🇬', '🇦🇮', '🇦🇱', '🇦🇲', '🇦🇴', '🇦🇶', '🇦🇷', '🇦🇸', '🇦🇹', '🇦🇺', '🇦🇼', '🇦🇽', '🇦🇿', '🇧🇦', '🇧🇧', '🇧🇩', '🇧🇪', '🇧🇫', '🇧🇬', '🇧🇭', '🇧🇮', '🇧🇯', '🇧🇱', '🇧🇲', '🇧🇳', '🇧🇴', '🇧🇶', '🇧🇷', '🇧🇸', '🇧🇹', '🇧🇻', '🇧🇼', '🇧🇾', '🇧🇿', '🇨🇦', '🇨🇨', '🇨🇩', '🇨🇫', '🇨🇬', '🇨🇭', '🇨🇮', '🇨🇰', '🇨🇱', '🇨🇲', '🇨🇳', '🇨🇴', '🇨🇵', '🇨🇷', '🇨🇺', '🇨🇻', '🇨🇼', '🇨🇽', '🇨🇾', '🇨🇿', '🇩🇪', '🇩🇬', '🇩🇯', '🇩🇰', '🇩🇲', '🇩🇴', '🇩🇿', '🇪🇦', '🇪🇨', '🇪🇪', '🇪🇬', '🇪🇭', '🇪🇷', '🇪🇸', '🇪🇹', '🇪🇺', '🇫🇮', '🇫🇯', '🇫🇰', '🇫🇲', '🇫🇴', '🇫🇷', '🇬🇦', '🇬🇧', '🇬🇩', '🇬🇪', '🇬🇫', '🇬🇬', '🇬🇭', '🇬🇮', '🇬🇱', '🇬🇲', '🇬🇳', '🇬🇵', '🇬🇶', '🇬🇷', '🇬🇸', '🇬🇹', '🇬🇺', '🇬🇼', '🇬🇾', '🇭🇰', '🇭🇲', '🇭🇳', '🇭🇷', '🇭🇹', '🇭🇺', '🇮🇨', '🇮🇩', '🇮🇪', '🇮🇱', '🇮🇲', '🇮🇳', '🇮🇴', '🇮🇶', '🇮🇷', '🇮🇸', '🇮🇹', '🇯🇪', '🇯🇲', '🇯🇴', '🇯🇵', '🇰🇪', '🇰🇬', '🇰🇭', '🇰🇮', '🇰🇲', '🇰🇳', '🇰🇵', '🇰🇷', '🇰🇼', '🇰🇾', '🇰🇿', '🇱🇦', '🇱🇧', '🇱🇨', '🇱🇮', '🇱🇰', '🇱🇷', '🇱🇸', '🇱🇹', '🇱🇺', '🇱🇻', '🇱🇾', '🇲🇦', '🇲🇨', '🇲🇩', '🇲🇪', '🇲🇫', '🇲🇬', '🇲🇭', '🇲🇰', '🇲🇱', '🇲🇲', '🇲🇳', '🇲🇴', '🇲🇵', '🇲🇶', '🇲🇷', '🇲🇸', '🇲🇹', '🇲🇺', '🇲🇻', '🇲🇼', '🇲🇽', '🇲🇾', '🇲🇿', '🇳🇦', '🇳🇨', '🇳🇪', '🇳🇫', '🇳🇬', '🇳🇮', '🇳🇱', '🇳🇴', '🇳🇵', '🇳🇷', '🇳🇺', '🇳🇿', '🇴🇲', '🇵🇦', '🇵🇪', '🇵🇫', '🇵🇬', '🇵🇭', '🇵🇰', '🇵🇱', '🇵🇲', '🇵🇳', '🇵🇷', '🇵🇸', '🇵🇹', '🇵🇼', '🇵🇾', '🇶🇦', '🇷🇪', '🇷🇴', '🇷🇸', '🇷🇺', '🇷🇼', '🇸🇦', '🇸🇧', '🇸🇨', '🇸🇩', '🇸🇪', '🇸🇬', '🇸🇭', '🇸🇮', '🇸🇯', '🇸🇰', '🇸🇱', '🇸🇲', '🇸🇳', '🇸🇴', '🇸🇷', '🇸🇸', '🇸🇹', '🇸🇻', '🇸🇽', '🇸🇾', '🇸🇿', '🇹🇦', '🇹🇨', '🇹🇩', '🇹🇫', '🇹🇬', '🇹🇭', '🇹🇯', '🇹🇰', '🇹🇱', '🇹🇲', '🇹🇳', '🇹🇴', '🇹🇷', '🇹🇹', '🇹🇻', '🇹🇼', '🇹🇿', '🇺🇦', '🇺🇬', '🇺🇲', '🇺🇳', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇦', '🇻🇨', '🇻🇪', '🇻🇬', '🇻🇮', '🇻🇳', '🇻🇺', '🇼🇫', '🇼🇸', '🇽🇰', '🇾🇪', '🇾🇹', '🇿🇦', '🇿🇲', '🇿🇼']
    }
  ];
  
  selectedEmojiCategory = 0;
  private categoryBarScrollPosition = 0;
  
  // Estado de búsqueda de emojis
  emojiSearchQuery = '';
  filteredEmojis: string[] = [];
  private emojiSearchInputElement: HTMLElement | null = null;
  
  // Trackear estado de selectores para cerrar emoji picker
  private previousProjectSelectIsOpen = false;
  private previousEnvironmentSelectIsOpen = false;
  private previousTaskTypeSelectIsOpen = false;
  
  // Diccionario de keywords bilingüe para búsqueda de emojis
  private emojiKeywords: { [emoji: string]: string[] } = {
    // Frecuentes
    '📝': ['note', 'memo', 'write', 'nota', 'escribir', 'tarea', 'documento'],
    '⏰': ['clock', 'alarm', 'time', 'reloj', 'alarma', 'tiempo', 'hora'],
    '✅': ['check', 'done', 'complete', 'listo', 'completado', 'hecho', 'correcto'],
    '🛏️': ['bed', 'sleep', 'cama', 'dormir', 'descansar'],
    '🍔': ['burger', 'hamburger', 'food', 'hamburguesa', 'comida'],
    '📅': ['calendar', 'date', 'calendario', 'fecha'],
    '📌': ['pin', 'pushpin', 'marker', 'chincheta', 'marcador'],
    '🔑': ['key', 'llave', 'acceso'],
    '📚': ['books', 'library', 'libros', 'biblioteca', 'estudiar'],
    '💻': ['computer', 'laptop', 'computadora', 'portatil'],
    '📱': ['phone', 'mobile', 'telefono', 'celular', 'movil'],
    '🔋': ['battery', 'power', 'bateria', 'energia'],
    '🏋️': ['gym', 'workout', 'exercise', 'gimnasio', 'ejercicio', 'pesas'],
    '🚴': ['bike', 'bicycle', 'cycling', 'bicicleta', 'ciclar'],
    '🚗': ['car', 'auto', 'vehicle', 'auto', 'coche', 'vehiculo'],
    '🍎': ['apple', 'fruit', 'manzana', 'fruta'],
    '🍕': ['pizza', 'food', 'comida'],
    '🛒': ['cart', 'shopping', 'carrito', 'compras'],
    '☕': ['coffee', 'cafe', 'café'],
    '🍷': ['wine', 'vino', 'drink', 'bebida'],
    '🎵': ['music', 'song', 'musica', 'cancion'],
    '🎮': ['game', 'gaming', 'video', 'juego', 'videojuego'],
    '🎨': ['art', 'paint', 'arte', 'pintar'],
    '✈️': ['plane', 'airplane', 'flight', 'avion', 'vuelo'],
    
    // Sonrisas y Emociones
    '😀': ['happy', 'smile', 'feliz', 'sonrisa', 'alegre', 'grinning'],
    '😃': ['happy', 'smile', 'feliz', 'sonrisa', 'big'],
    '😄': ['happy', 'smile', 'feliz', 'sonrisa', 'laugh'],
    '😁': ['happy', 'smile', 'feliz', 'sonrisa', 'grin'],
    '😆': ['happy', 'laugh', 'feliz', 'risa', 'funny'],
    '😅': ['happy', 'sweat', 'feliz', 'sudor', 'nervous'],
    '🤣': ['laugh', 'funny', 'risa', 'gracioso', 'rofl'],
    '😂': ['laugh', 'cry', 'risa', 'llorar', 'tears'],
    '🙂': ['smile', 'happy', 'sonrisa', 'feliz'],
    '🙃': ['upside', 'down', 'alreves', 'invertido'],
    '😉': ['wink', 'guino', 'ojito'],
    '😊': ['smile', 'blush', 'sonrisa', 'sonrojado', 'feliz'],
    '😇': ['angel', 'innocent', 'angel', 'inocente'],
    '🥰': ['love', 'hearts', 'amor', 'corazones'],
    '😍': ['love', 'heart', 'eyes', 'amor', 'corazon', 'ojos'],
    '🤩': ['star', 'eyes', 'estrella', 'ojos', 'famous'],
    '😘': ['kiss', 'beso', 'love', 'amor'],
    '😗': ['kiss', 'beso'],
    '😚': ['kiss', 'beso', 'closed'],
    '😙': ['kiss', 'beso', 'smile'],
    '😋': ['yum', 'delicious', 'rico', 'delicioso', 'sabroso'],
    '😛': ['tongue', 'lengua', 'playful'],
    '😜': ['wink', 'tongue', 'guino', 'lengua'],
    '🤪': ['crazy', 'zany', 'loco', 'chiflado'],
    '😝': ['tongue', 'closed', 'lengua', 'cerrado'],
    '🤑': ['money', 'mouth', 'dinero', 'boca', 'rich'],
    '🤗': ['hug', 'abrazar', 'embrace'],
    '🤭': ['hand', 'mouth', 'mano', 'boca', 'secret'],
    '🤫': ['shush', 'quiet', 'silencio', 'callado'],
    '🤔': ['think', 'thinking', 'pensar', 'pensamiento'],
    '🤐': ['zipper', 'mouth', 'cremallera', 'boca', 'quiet'],
    '🤨': ['raised', 'eyebrow', 'ceja', 'suspicious'],
    '😐': ['neutral', 'face', 'neutral', 'cara'],
    '😑': ['expressionless', 'sin', 'expresion'],
    '😶': ['no', 'mouth', 'sin', 'boca'],
    '😏': ['smirk', 'sonrisa', 'maliciosa'],
    '😒': ['unamused', 'no', 'divertido'],
    '🙄': ['roll', 'eyes', 'girar', 'ojos'],
    '😬': ['grimace', 'mueca'],
    '🤥': ['lying', 'mentira', 'mentiroso'],
    '😌': ['relieved', 'aliviado'],
    '😔': ['sad', 'pensive', 'triste', 'pensativo'],
    '😪': ['sleepy', 'tired', 'sueño', 'cansado'],
    '🤤': ['drool', 'babeo', 'hungry'],
    '😴': ['sleep', 'sleeping', 'dormir', 'durmiendo'],
    '😷': ['mask', 'sick', 'mascara', 'enfermo'],
    '🤒': ['sick', 'fever', 'enfermo', 'fiebre'],
    '🤕': ['hurt', 'bandage', 'herido', 'vendaje'],
    '🤢': ['nauseated', 'nauseas', 'sick'],
    '🤮': ['vomit', 'vomitar', 'sick'],
    '🤧': ['sneeze', 'estornudo', 'sick'],
    '🥵': ['hot', 'caliente', 'fever'],
    '🥶': ['cold', 'frio', 'freezing'],
    '😱': ['scream', 'fear', 'grito', 'miedo', 'terror'],
    '😨': ['fear', 'scared', 'miedo', 'asustado'],
    '😰': ['anxious', 'sweat', 'ansioso', 'sudor'],
    '😥': ['sad', 'relieved', 'triste', 'aliviado'],
    '😓': ['sweat', 'sad', 'sudor', 'triste'],
    
    // Gestos y Personas
    '👋': ['wave', 'hello', 'saludar', 'hola', 'mano'],
    '👍': ['thumbs', 'up', 'like', 'pulgar', 'arriba', 'me', 'gusta'],
    '👎': ['thumbs', 'down', 'dislike', 'pulgar', 'abajo', 'no', 'gusta'],
    '👏': ['clap', 'applause', 'aplaudir', 'aplauso'],
    '🙌': ['raise', 'hands', 'levantar', 'manos', 'celebration'],
    '👐': ['open', 'hands', 'abrir', 'manos'],
    '🤲': ['palms', 'together', 'palmas', 'juntas'],
    '🤝': ['handshake', 'apretón', 'manos'],
    '🙏': ['pray', 'please', 'rezar', 'por', 'favor'],
    '✍️': ['write', 'writing', 'escribir', 'escritura'],
    '💪': ['muscle', 'strong', 'musculo', 'fuerte', 'fuerza'],
    '👂': ['ear', 'oreja', 'listen', 'escuchar'],
    '👃': ['nose', 'nariz', 'smell', 'oler'],
    '👶': ['baby', 'bebe', 'infant'],
    '👧': ['girl', 'niña', 'child'],
    '👦': ['boy', 'niño', 'child'],
    '👩': ['woman', 'mujer', 'female'],
    '👨': ['man', 'hombre', 'male'],
    '👴': ['old', 'man', 'viejo', 'hombre', 'elder'],
    '👵': ['old', 'woman', 'vieja', 'mujer', 'elder'],
    '👮': ['police', 'cop', 'policia'],
    '👷': ['construction', 'worker', 'obrero', 'construccion'],
    '💂': ['guard', 'guarda', 'security'],
    '🥷': ['ninja', 'ninja'],
    '👸': ['princess', 'princesa'],
    '🤴': ['prince', 'principe'],
    '🧙': ['wizard', 'magician', 'mago', 'magia'],
    '🧚': ['fairy', 'hada'],
    '🧛': ['vampire', 'vampiro'],
    '🧜': ['mermaid', 'sirena'],
    '🧝': ['elf', 'elfo'],
    '🧞': ['genie', 'genio'],
    '🧟': ['zombie', 'zombie'],
    '🏃': ['run', 'running', 'correr', 'corriendo'],
    '🚶': ['walk', 'walking', 'caminar', 'caminando'],
    '💃': ['dance', 'dancing', 'bailar', 'bailando', 'woman'],
    '🕺': ['dance', 'dancing', 'bailar', 'bailando', 'man'],
    '🧘': ['yoga', 'meditation', 'meditacion'],
    
    // Animales y Naturaleza
    '🐶': ['dog', 'puppy', 'perro', 'cachorro'],
    '🐱': ['cat', 'kitten', 'gato', 'gatito'],
    '🐭': ['mouse', 'raton'],
    '🐹': ['hamster', 'hamster'],
    '🐰': ['rabbit', 'bunny', 'conejo'],
    '🦊': ['fox', 'zorro'],
    '🐻': ['bear', 'oso'],
    '🐼': ['panda', 'panda'],
    '🐨': ['koala', 'koala'],
    '🐯': ['tiger', 'tigre'],
    '🦁': ['lion', 'leon'],
    '🐮': ['cow', 'vaca'],
    '🐷': ['pig', 'cerdo'],
    '🐸': ['frog', 'rana'],
    '🐵': ['monkey', 'mono'],
    '🐔': ['chicken', 'rooster', 'pollo', 'gallo'],
    '🐦': ['bird', 'pajaro', 'ave'],
    '🦅': ['eagle', 'aguila'],
    '🦉': ['owl', 'buho'],
    '🐺': ['wolf', 'lobo'],
    '🐴': ['horse', 'caballo'],
    '🦄': ['unicorn', 'unicornio'],
    '🐝': ['bee', 'honey', 'abeja', 'miel'],
    '🦋': ['butterfly', 'mariposa'],
    '🐢': ['turtle', 'tortuga'],
    '🐍': ['snake', 'serpiente'],
    '🐙': ['octopus', 'pulpo'],
    '🐬': ['dolphin', 'delfin'],
    '🐳': ['whale', 'ballena'],
    '🦈': ['shark', 'tiburon'],
    '🌍': ['earth', 'world', 'tierra', 'mundo'],
    '🌎': ['earth', 'americas', 'tierra', 'americas'],
    '🌏': ['earth', 'asia', 'tierra', 'asia'],
    '🌋': ['volcano', 'volcan'],
    '🗻': ['mountain', 'fuji', 'montaña'],
    '🏔️': ['mountain', 'snow', 'montaña', 'nieve'],
    '🌲': ['tree', 'evergreen', 'arbol', 'siempreverde'],
    '🌳': ['tree', 'deciduous', 'arbol'],
    '🌴': ['palm', 'tree', 'palmera'],
    '🌵': ['cactus', 'cactus'],
    '🌾': ['rice', 'arroz', 'grain'],
    '🌿': ['herb', 'hierba', 'plant'],
    '🍀': ['clover', 'four', 'leaf', 'trebol', 'suerte'],
    '🍁': ['maple', 'leaf', 'hoja', 'arce'],
    '🍂': ['fallen', 'leaf', 'hoja', 'caida'],
    '🍃': ['leaf', 'wind', 'hoja', 'viento'],
    
    // Comida y Bebida
    '🍊': ['orange', 'naranja', 'fruit'],
    '🍋': ['lemon', 'limon', 'fruit'],
    '🍌': ['banana', 'platano', 'fruit'],
    '🍉': ['watermelon', 'sandia', 'fruit'],
    '🍇': ['grapes', 'uvas', 'fruit'],
    '🍓': ['strawberry', 'fresa', 'fruit'],
    '🍈': ['melon', 'melon', 'fruit'],
    '🍒': ['cherry', 'cereza', 'fruit'],
    '🍑': ['peach', 'durazno', 'fruit'],
    '🥭': ['mango', 'mango', 'fruit'],
    '🍍': ['pineapple', 'piña', 'fruit'],
    '🥥': ['coconut', 'coco', 'fruit'],
    '🥝': ['kiwi', 'kiwi', 'fruit'],
    '🍅': ['tomato', 'tomate'],
    '🍆': ['eggplant', 'aubergine', 'berenjena'],
    '🥑': ['avocado', 'aguacate'],
    '🥦': ['broccoli', 'brocoli'],
    '🥬': ['leafy', 'green', 'verde', 'hoja'],
    '🥒': ['cucumber', 'pepino'],
    '🌶️': ['pepper', 'chili', 'pimiento', 'chile', 'picante'],
    '🌽': ['corn', 'maiz'],
    '🥕': ['carrot', 'zanahoria'],
    '🥔': ['potato', 'papa', 'patata'],
    '🍠': ['sweet', 'potato', 'camote', 'batata'],
    '🥐': ['croissant', 'croissant'],
    '🥯': ['bagel', 'bagel'],
    '🍞': ['bread', 'pan'],
    '🥖': ['baguette', 'baguette', 'bread', 'pan'],
    '🧀': ['cheese', 'queso'],
    '🥚': ['egg', 'huevo'],
    '🍳': ['cooking', 'fried', 'egg', 'cocinar', 'huevo', 'frito'],
    '🥞': ['pancakes', 'hotcakes', 'panqueques'],
    '🥓': ['bacon', 'tocino'],
    '🥩': ['meat', 'carne'],
    '🍗': ['poultry', 'leg', 'pollo', 'pierna'],
    '🍖': ['meat', 'bone', 'carne', 'hueso'],
    '🌭': ['hot', 'dog', 'perro', 'caliente'],
    '🍟': ['fries', 'french', 'fries', 'papas', 'fritas'],
    '🥪': ['sandwich', 'sandwich'],
    '🥙': ['stuffed', 'flatbread', 'torta', 'rellena'],
    '🌮': ['taco', 'taco'],
    '🌯': ['burrito', 'burrito'],
    '🥗': ['salad', 'ensalada'],
    '🥘': ['shallow', 'pan', 'food', 'cazuela'],
    '🍝': ['spaghetti', 'pasta', 'espagueti'],
    '🍜': ['steaming', 'bowl', 'ramen', 'tazon', 'humo'],
    '🍲': ['pot', 'food', 'olla', 'comida'],
    '🍛': ['curry', 'rice', 'curry', 'arroz'],
    '🍣': ['sushi', 'sushi'],
    '🍱': ['bento', 'box', 'bento'],
    '🥟': ['dumpling', 'empanada'],
    '🍤': ['fried', 'shrimp', 'camaron', 'frito'],
    '🍙': ['rice', 'ball', 'arroz', 'bola'],
    '🍚': ['cooked', 'rice', 'arroz', 'cocido'],
    '🍘': ['rice', 'cracker', 'arroz', 'galleta'],
    '🍢': ['oden', 'skewer', 'brocheta'],
    '🍡': ['dango', 'dango'],
    '🍧': ['shaved', 'ice', 'raspado', 'hielo'],
    '🍨': ['ice', 'cream', 'helado'],
    '🍦': ['soft', 'ice', 'cream', 'helado', 'suave'],
    '🥧': ['pie', 'pastel'],
    '🧁': ['cupcake', 'cupcake'],
    '🍰': ['cake', 'pastel', 'torta'],
    '🎂': ['birthday', 'cake', 'cumpleaños', 'pastel'],
    '🍮': ['custard', 'flan', 'pudding'],
    '🍭': ['lollipop', 'candy', 'paleta', 'dulce'],
    '🍬': ['candy', 'dulce', 'caramelo'],
    '🍫': ['chocolate', 'bar', 'chocolate', 'barra'],
    '🍿': ['popcorn', 'palomitas'],
    '🍩': ['doughnut', 'donut', 'donut', 'rosquilla'],
    '🍪': ['cookie', 'biscuit', 'galleta'],
    '🥜': ['peanuts', 'cacahuates', 'manies'],
    '🍯': ['honey', 'pot', 'miel', 'tarro'],
    '🥛': ['milk', 'glass', 'leche', 'vaso'],
    '🍼': ['baby', 'bottle', 'biberon'],
    '🍵': ['tea', 'te', 'green', 'verde'],
    '🧃': ['beverage', 'box', 'bebida', 'caja'],
    '🥤': ['cup', 'straw', 'vaso', 'popote', 'sorbete'],
    '🍶': ['sake', 'sake'],
    '🍺': ['beer', 'cerveza'],
    '🍻': ['beers', 'cheers', 'cervezas', 'salud'],
    '🥂': ['champagne', 'toast', 'champan', 'brindis'],
    '🥃': ['tumbler', 'glass', 'whiskey', 'vaso', 'whisky'],
    '🍸': ['cocktail', 'glass', 'coctel', 'vaso'],
    '🍹': ['tropical', 'drink', 'bebida', 'tropical'],
    '🧉': ['mate', 'mate'],
    '🍾': ['champagne', 'bottle', 'champan', 'botella'],
    '🧊': ['ice', 'cubo', 'hielo'],
    
    // Actividades y Deportes
    '⚽': ['soccer', 'football', 'futbol', 'balon'],
    '🏀': ['basketball', 'baloncesto', 'basquet'],
    '🏈': ['american', 'football', 'futbol', 'americano'],
    '⚾': ['baseball', 'beisbol'],
    '🥎': ['softball', 'softball'],
    '🎾': ['tennis', 'tenis'],
    '🏐': ['volleyball', 'voleibol'],
    '🏉': ['rugby', 'rugby'],
    '🥏': ['flying', 'disc', 'disco', 'volador'],
    '🎱': ['pool', '8ball', 'billar'],
    '🏓': ['ping', 'pong', 'tenis', 'mesa'],
    '🏸': ['badminton', 'badminton'],
    '🏒': ['ice', 'hockey', 'hockey', 'hielo'],
    '🏑': ['field', 'hockey', 'hockey', 'campo'],
    '🏏': ['cricket', 'cricket'],
    '⛳': ['golf', 'flag', 'golf', 'bandera'],
    '🏹': ['bow', 'arrow', 'arco', 'flecha'],
    '🎣': ['fishing', 'pole', 'pescar', 'caña'],
    '🥊': ['boxing', 'glove', 'boxeo', 'guante'],
    '🥋': ['martial', 'arts', 'uniform', 'artes', 'marciales'],
    '🎽': ['running', 'shirt', 'correr', 'camiseta'],
    '🛹': ['skateboard', 'patineta', 'skate'],
    '🛷': ['sled', 'trineo'],
    '⛸️': ['ice', 'skate', 'patin', 'hielo'],
    '🥌': ['curling', 'stone', 'curling'],
    '🎿': ['skis', 'esquis'],
    '🏂': ['snowboard', 'snowboard'],
    '🏄': ['surfing', 'surf'],
    '🏊': ['swimming', 'natacion', 'nadar'],
    '🚣': ['rowing', 'boat', 'remo', 'bote'],
    '🧗': ['climbing', 'escalar', 'montaña'],
    '🚵': ['mountain', 'biking', 'bicicleta', 'montaña'],
    '🎯': ['target', 'dart', 'diana', 'objetivo'],
    '🕹️': ['joystick', 'palanca', 'mando'],
    '🎰': ['slot', 'machine', 'tragamonedas', 'maquina'],
    '🎲': ['dice', 'game', 'dado', 'juego'],
    '🃏': ['joker', 'joker', 'carta'],
    '🀄': ['mahjong', 'red', 'dragon', 'mahjong'],
    '🎴': ['flower', 'playing', 'cards', 'flor', 'cartas'],
    '🎭': ['theater', 'masks', 'teatro', 'mascaras'],
    '🎬': ['movie', 'camera', 'pelicula', 'camara'],
    '🎤': ['microphone', 'microfono', 'sing', 'cantar'],
    '🎧': ['headphone', 'audifonos', 'auriculares'],
    '🎼': ['musical', 'score', 'partitura'],
    '🎹': ['piano', 'piano', 'teclado'],
    '🥁': ['drum', 'tambor', 'bateria'],
    '🎷': ['saxophone', 'saxofon'],
    '🎺': ['trumpet', 'trompeta'],
    '🎸': ['guitar', 'guitarra'],
    '🎻': ['violin', 'violin'],
    '🎳': ['bowling', 'bolos'],
    
    // Viajes y Lugares
    '🚕': ['taxi', 'taxi'],
    '🚙': ['suv', 'sport', 'utility', 'vehicle'],
    '🚌': ['bus', 'autobus', 'omnibus'],
    '🚎': ['trolleybus', 'trolebus'],
    '🏎️': ['racing', 'car', 'auto', 'carreras'],
    '🚓': ['police', 'car', 'patrulla', 'policia'],
    '🚑': ['ambulance', 'ambulancia'],
    '🚒': ['fire', 'engine', 'bomberos', 'camion'],
    '🚐': ['minibus', 'minivan', 'minivan'],
    '🚚': ['delivery', 'truck', 'camion', 'reparto'],
    '🚛': ['articulated', 'lorry', 'camion', 'articulado'],
    '🚜': ['tractor', 'tractor'],
    '🛴': ['scooter', 'scooter', 'patineta'],
    '🚲': ['bicycle', 'bike', 'bicicleta'],
    '🛵': ['motor', 'scooter', 'moto', 'scooter'],
    '🏍️': ['motorcycle', 'motocicleta', 'moto'],
    '🛺': ['auto', 'rickshaw', 'rickshaw'],
    '🚨': ['police', 'car', 'light', 'patrulla', 'luz'],
    '🚔': ['police', 'car', 'patrulla'],
    '🚍': ['oncoming', 'bus', 'autobus', 'viene'],
    '🚘': ['oncoming', 'automobile', 'auto', 'viene'],
    '🚖': ['oncoming', 'taxi', 'taxi', 'viene'],
    '🚡': ['aerial', 'tramway', 'teleferico'],
    '🚠': ['mountain', 'cableway', 'teleferico', 'montaña'],
    '🚟': ['suspension', 'railway', 'ferrocarril', 'suspension'],
    '🚃': ['tram', 'car', 'tranvia'],
    '🚋': ['tram', 'tranvia'],
    '🚞': ['mountain', 'railway', 'ferrocarril', 'montaña'],
    '🚝': ['monorail', 'monorriel'],
    '🚄': ['high', 'speed', 'train', 'tren', 'alta', 'velocidad'],
    '🚅': ['bullet', 'train', 'tren', 'balas'],
    '🚈': ['light', 'rail', 'tren', 'ligero'],
    '🚂': ['locomotive', 'steam', 'locomotora', 'vapor'],
    '🚆': ['train', 'tren'],
    '🚇': ['metro', 'subway', 'metro', 'subterraneo'],
    '🚊': ['tram', 'tranvia'],
    '🚉': ['station', 'estacion'],
    '🛫': ['airplane', 'departure', 'avion', 'salida'],
    '🛬': ['airplane', 'arrival', 'avion', 'llegada'],
    '🛩️': ['small', 'airplane', 'avion', 'pequeño'],
    '💺': ['seat', 'asiento'],
    '🚁': ['helicopter', 'helicoptero'],
    '⛵': ['sailboat', 'velero', 'barco'],
    '🚤': ['speedboat', 'lancha', 'rapida'],
    '🛥️': ['motor', 'boat', 'barco', 'motor'],
    '🛳️': ['passenger', 'ship', 'barco', 'pasajeros'],
    '⛴️': ['ferry', 'ferry'],
    '🚢': ['ship', 'barco', 'buque'],
    '⚓': ['anchor', 'ancla'],
    '⛽': ['fuel', 'pump', 'gasolinera', 'gasolina'],
    '🚧': ['construction', 'construccion', 'obras'],
    '🚦': ['vertical', 'traffic', 'light', 'semaforo', 'vertical'],
    '🚥': ['horizontal', 'traffic', 'light', 'semaforo', 'horizontal'],
    '🗺️': ['world', 'map', 'mapa', 'mundo'],
    '🗿': ['moai', 'moai', 'easter', 'island'],
    '🗽': ['statue', 'liberty', 'estatua', 'libertad'],
    '🗼': ['tokyo', 'tower', 'torre', 'tokio'],
    '🏰': ['castle', 'castillo'],
    '🏯': ['japanese', 'castle', 'castillo', 'japones'],
    '🏟️': ['stadium', 'estadio'],
    '🎡': ['ferris', 'wheel', 'rueda', 'ferris'],
    '🎢': ['roller', 'coaster', 'montaña', 'rusa'],
    '🎠': ['carousel', 'horse', 'carrusel', 'caballos'],
    '⛲': ['fountain', 'fuente'],
    '⛱️': ['umbrella', 'beach', 'sombrilla', 'playa'],
    '🏖️': ['beach', 'umbrella', 'playa', 'sombrilla'],
    '🏝️': ['desert', 'island', 'isla', 'desierta'],
    '🏜️': ['desert', 'desierto'],
    '🏕️': ['camping', 'campamento'],
    '⛺': ['tent', 'tienda', 'campamento'],
    '🏠': ['house', 'casa', 'home'],
    '🏡': ['house', 'garden', 'casa', 'jardin'],
    '🏘️': ['houses', 'casas'],
    '🏚️': ['derelict', 'house', 'casa', 'abandonada'],
    '🏗️': ['building', 'construction', 'construccion', 'edificio'],
    '🏭': ['factory', 'fabrica'],
    '🏢': ['office', 'building', 'oficina', 'edificio'],
    '🏬': ['department', 'store', 'tienda', 'departamentos'],
    '🏣': ['japanese', 'post', 'office', 'oficina', 'correos'],
    '🏤': ['post', 'office', 'oficina', 'correos'],
    '🏥': ['hospital', 'hospital'],
    '🏦': ['bank', 'banco'],
    '🏨': ['hotel', 'hotel'],
    '🏪': ['convenience', 'store', 'tienda', 'conveniencia'],
    '🏫': ['school', 'escuela', 'colegio'],
    '🏩': ['love', 'hotel', 'hotel', 'amor'],
    '💒': ['wedding', 'boda'],
    '🏛️': ['classical', 'building', 'edificio', 'clasico'],
    '⛪': ['church', 'iglesia'],
    '🕌': ['mosque', 'mezquita'],
    '🕍': ['synagogue', 'sinagoga'],
    '🛕': ['hindu', 'temple', 'templo', 'hindu'],
    '🕋': ['kaaba', 'kaaba', 'mecca'],
    '⛩️': ['shinto', 'shrine', 'santuario', 'shinto'],
    '🛤️': ['railway', 'track', 'via', 'ferrea'],
    '🛣️': ['motorway', 'autopista'],
    '🗾': ['map', 'japan', 'mapa', 'japon'],
    '🎑': ['moon', 'viewing', 'ceremony', 'luna', 'ceremonia'],
    '🏞️': ['national', 'park', 'parque', 'nacional'],
    '🌅': ['sunrise', 'amanecer'],
    '🌄': ['sunrise', 'mountains', 'amanecer', 'montañas'],
    '🌠': ['shooting', 'star', 'estrella', 'fugaz'],
    '🎇': ['sparkler', 'bengala'],
    '🎆': ['fireworks', 'fuegos', 'artificiales'],
    '🌇': ['sunset', 'atardecer', 'puesta', 'sol'],
    '🌆': ['cityscape', 'dusk', 'ciudad', 'anochecer'],
    '🏙️': ['cityscape', 'ciudad', 'paisaje'],
    '🌃': ['night', 'stars', 'noche', 'estrellas'],
    '🌌': ['milky', 'way', 'via', 'lactea'],
    '🌉': ['bridge', 'night', 'puente', 'noche'],
    '🌁': ['foggy', 'niebla'],
    
    // Objetos
    '⌚': ['watch', 'reloj', 'pulsera'],
    '📲': ['mobile', 'phone', 'arrow', 'telefono', 'flecha'],
    '⌨️': ['keyboard', 'teclado'],
    '🖥️': ['desktop', 'computer', 'computadora', 'escritorio'],
    '🖨️': ['printer', 'impresora'],
    '🖱️': ['computer', 'mouse', 'raton', 'computadora'],
    '🖲️': ['trackball', 'trackball'],
    '🗜️': ['clamp', 'compression', 'compresor'],
    '💾': ['floppy', 'disk', 'disco', 'floppy'],
    '💿': ['optical', 'disk', 'cd', 'disco'],
    '📀': ['dvd', 'dvd'],
    '📼': ['videocassette', 'videocasete'],
    '📷': ['camera', 'camara', 'photo'],
    '📸': ['camera', 'flash', 'camara', 'flash'],
    '📹': ['video', 'camera', 'camara', 'video'],
    '🎥': ['movie', 'camera', 'camara', 'pelicula'],
    '📽️': ['film', 'projector', 'proyector', 'pelicula'],
    '🎞️': ['film', 'frames', 'pelicula', 'fotogramas'],
    '📞': ['telephone', 'receiver', 'telefono', 'auricular'],
    '☎️': ['telephone', 'telefono'],
    '📟': ['pager', 'busca', 'localizador'],
    '📠': ['fax', 'machine', 'fax'],
    '📺': ['television', 'tv', 'television'],
    '📻': ['radio', 'radio'],
    '🎙️': ['studio', 'microphone', 'microfono', 'estudio'],
    '🎚️': ['level', 'slider', 'control', 'nivel'],
    '🎛️': ['control', 'knobs', 'controles', 'perillas'],
    '⏱️': ['stopwatch', 'cronometro'],
    '⏲️': ['timer', 'clock', 'temporizador', 'reloj'],
    '🕰️': ['mantelpiece', 'clock', 'reloj', 'repisa'],
    '⌛': ['hourglass', 'done', 'reloj', 'arena', 'terminado'],
    '⏳': ['hourglass', 'not', 'done', 'reloj', 'arena', 'no', 'terminado'],
    '📡': ['satellite', 'antenna', 'satelite', 'antena'],
    '🔌': ['electric', 'plug', 'enchufe', 'electrico'],
    '💡': ['light', 'bulb', 'bombilla', 'luz', 'idea'],
    '🔦': ['flashlight', 'linterna'],
    '🕯️': ['candle', 'vela'],
    '🪔': ['diya', 'lamp', 'lampara', 'diya'],
    '🧯': ['fire', 'extinguisher', 'extintor'],
    '🛢️': ['oil', 'drum', 'barril', 'aceite'],
    '💸': ['money', 'wings', 'dinero', 'alas', 'gastar'],
    '💵': ['dollar', 'banknote', 'dolar', 'billete'],
    '💴': ['yen', 'banknote', 'yen', 'billete'],
    '💶': ['euro', 'banknote', 'euro', 'billete'],
    '💷': ['pound', 'banknote', 'libra', 'billete'],
    '💳': ['credit', 'card', 'tarjeta', 'credito'],
    '💎': ['gem', 'stone', 'diamante', 'gema'],
    '⚖️': ['balance', 'scale', 'balanza', 'justicia'],
    '🪜': ['ladder', 'escalera'],
    '🧰': ['toolbox', 'caja', 'herramientas'],
    '🪛': ['screwdriver', 'destornillador'],
    '🔧': ['wrench', 'llave', 'herramienta'],
    '🔨': ['hammer', 'martillo'],
    '⚒️': ['hammer', 'pick', 'martillo', 'pico'],
    '🛠️': ['hammer', 'wrench', 'martillo', 'llave'],
    '⛏️': ['pick', 'pico'],
    '🪚': ['carpentry', 'saw', 'sierra', 'carpinteria'],
    '🔩': ['nut', 'bolt', 'tuerca', 'perno'],
    '⚙️': ['gear', 'engranaje'],
    '🪤': ['mouse', 'trap', 'ratonera'],
    '🧱': ['brick', 'ladrillo'],
    '⛓️': ['chains', 'cadenas'],
    '🧲': ['magnet', 'imán'],
    '🔫': ['water', 'pistol', 'pistola', 'agua', 'juguete'],
    '💣': ['bomb', 'bomba'],
    '🧨': ['firecracker', 'petardo'],
    '🪓': ['axe', 'hacha'],
    '🔪': ['kitchen', 'knife', 'cuchillo', 'cocina'],
    '🗡️': ['dagger', 'daga'],
    '⚔️': ['crossed', 'swords', 'espadas', 'cruzadas'],
    '🛡️': ['shield', 'escudo'],
    '🚬': ['cigarette', 'cigarro'],
    '⚰️': ['coffin', 'ataud'],
    '🪦': ['headstone', 'lapida'],
    '⚱️': ['funeral', 'urn', 'urna', 'funeraria'],
    '🏺': ['amphora', 'anfora'],
    '🔮': ['crystal', 'ball', 'bola', 'cristal'],
    '📿': ['prayer', 'beads', 'rosario'],
    '🧿': ['nazar', 'amuleto', 'nazar'],
    '💈': ['barber', 'pole', 'barbero', 'poste'],
    '⚗️': ['alembic', 'alambique'],
    '🔭': ['telescope', 'telescopio'],
    '🔬': ['microscope', 'microscopio'],
    '🕳️': ['hole', 'agujero'],
    '🩹': ['adhesive', 'bandage', 'curita', 'vendaje'],
    '🩺': ['stethoscope', 'estetoscopio'],
    '💊': ['pill', 'pildora', 'medicina'],
    '💉': ['syringe', 'jeringa', 'inyeccion'],
    '🩸': ['drop', 'blood', 'gota', 'sangre'],
    '🧬': ['dna', 'adn'],
    '🦠': ['microbe', 'microbio'],
    '🧫': ['petri', 'dish', 'placa', 'petri'],
    '🧪': ['test', 'tube', 'tubo', 'ensayo'],
    '🌡️': ['thermometer', 'termometro'],
    '🧹': ['broom', 'escoba'],
    '🪠': ['plunger', 'destapador'],
    '🧺': ['basket', 'canasta', 'cesta'],
    '🧻': ['roll', 'paper', 'papel', 'higienico'],
    '🚽': ['toilet', 'inodoro', 'baño'],
    '🚿': ['shower', 'ducha'],
    '🛁': ['bathtub', 'bañera'],
    '🛀': ['person', 'bath', 'baño', 'persona'],
    '🧼': ['soap', 'jabon'],
    '🪥': ['toothbrush', 'cepillo', 'dientes'],
    '🪒': ['razor', 'navaja', 'afeitar'],
    '🪣': ['bucket', 'cubo', 'balde'],
    '🧴': ['lotion', 'bottle', 'botella', 'loción'],
    '🛎️': ['bellhop', 'bell', 'timbre', 'hotel'],
    '🗝️': ['old', 'key', 'llave', 'vieja'],
    '🚪': ['door', 'puerta'],
    '🪑': ['chair', 'silla'],
    '🛋️': ['couch', 'lamp', 'sofa', 'lampara'],
    '🛌': ['person', 'bed', 'cama', 'persona'],
    '🧸': ['teddy', 'bear', 'oso', 'peluche'],
    '🪆': ['nesting', 'dolls', 'matrioska', 'muñecas'],
    '🪞': ['mirror', 'espejo'],
    '🪟': ['window', 'ventana'],
    '🛍️': ['shopping', 'bags', 'bolsas', 'compras'],
    '🎁': ['wrapped', 'gift', 'regalo', 'envuelto'],
    '🎈': ['balloon', 'globo'],
    '🎏': ['carp', 'streamer', 'carp', 'banderines'],
    '🎀': ['ribbon', 'lazo', 'cinta'],
    '🪄': ['magic', 'wand', 'varita', 'magica'],
    '🪅': ['pinata', 'piñata'],
    '🪡': ['thread', 'hilo', 'coser'],
    '🧵': ['spool', 'thread', 'carrete', 'hilo'],
    '🪢': ['knot', 'nudo'],
    '👓': ['glasses', 'gafas', 'lentes'],
    '🕶️': ['sunglasses', 'gafas', 'sol'],
    '🥽': ['goggles', 'gafas', 'proteccion'],
    '🥼': ['lab', 'coat', 'bata', 'laboratorio'],
    '🦺': ['safety', 'vest', 'chaleco', 'seguridad'],
    '👔': ['necktie', 'corbata'],
    '👕': ['t', 'shirt', 'camiseta'],
    '👖': ['jeans', 'pantalones', 'vaqueros'],
    '🩱': ['one', 'piece', 'swimsuit', 'traje', 'baño', 'pieza'],
    '🩲': ['briefs', 'calzoncillos'],
    '🩳': ['shorts', 'pantalones', 'cortos'],
    '👗': ['dress', 'vestido'],
    '👘': ['kimono', 'kimono'],
    '🥻': ['sari', 'sari'],
    '🩴': ['thong', 'sandal', 'chancleta'],
    '👠': ['high', 'heeled', 'shoe', 'tacones', 'altos'],
    '👡': ['woman', 's', 'sandal', 'sandalia', 'mujer'],
    '👢': ['woman', 's', 'boot', 'bota', 'mujer'],
    '👞': ['man', 's', 'shoe', 'zapato', 'hombre'],
    '👟': ['running', 'shoe', 'zapato', 'correr'],
    '🥾': ['hiking', 'boot', 'bota', 'senderismo'],
    '🥿': ['flat', 'shoe', 'zapato', 'plano'],
    '🧦': ['socks', 'calcetines'],
    '🧤': ['gloves', 'guantes'],
    '🧣': ['scarf', 'bufanda'],
    '🎩': ['top', 'hat', 'sombrero', 'copa'],
    '🧢': ['billed', 'cap', 'gorra'],
    '👒': ['woman', 's', 'hat', 'sombrero', 'mujer'],
    '🎓': ['graduation', 'cap', 'birrete', 'graduacion'],
    '⛑️': ['rescue', 'worker', 's', 'helmet', 'casco', 'rescate'],
    '🪖': ['military', 'helmet', 'casco', 'militar'],
    '💄': ['lipstick', 'labial', 'pintalabios'],
    '💍': ['ring', 'anillo'],
    '💼': ['briefcase', 'portafolio', 'maletin'],
    '👜': ['handbag', 'bolso', 'mano'],
    '👝': ['pouch', 'bolsa', 'pequeña'],
    '👛': ['purse', 'monedero', 'cartera'],
    '🎒': ['backpack', 'mochila'],
    '🧳': ['luggage', 'equipaje', 'maleta'],
    '🌂': ['closed', 'umbrella', 'paraguas', 'cerrado'],
    '☂️': ['umbrella', 'paraguas'],
    
    // Símbolos
    '❤️': ['red', 'heart', 'corazon', 'rojo', 'amor'],
    '🧡': ['orange', 'heart', 'corazon', 'naranja'],
    '💛': ['yellow', 'heart', 'corazon', 'amarillo'],
    '💚': ['green', 'heart', 'corazon', 'verde'],
    '💙': ['blue', 'heart', 'corazon', 'azul'],
    '💜': ['purple', 'heart', 'corazon', 'morado'],
    '🖤': ['black', 'heart', 'corazon', 'negro'],
    '🤍': ['white', 'heart', 'corazon', 'blanco'],
    '🤎': ['brown', 'heart', 'corazon', 'cafe'],
    '💔': ['broken', 'heart', 'corazon', 'roto'],
    '❣️': ['heart', 'exclamation', 'corazon', 'exclamacion'],
    '💕': ['two', 'hearts', 'dos', 'corazones'],
    '💞': ['revolving', 'hearts', 'corazones', 'girando'],
    '💓': ['beating', 'heart', 'corazon', 'latido'],
    '💗': ['growing', 'heart', 'corazon', 'creciendo'],
    '💖': ['sparkling', 'heart', 'corazon', 'brillante'],
    '💘': ['heart', 'arrow', 'corazon', 'flecha', 'cupido'],
    '💝': ['heart', 'ribbon', 'corazon', 'lazo', 'regalo'],
    '💟': ['heart', 'decoration', 'corazon', 'decoracion'],
    '☮️': ['peace', 'symbol', 'paz', 'simbolo'],
    '✝️': ['latin', 'cross', 'cruz', 'latina'],
    '☪️': ['star', 'crescent', 'estrella', 'creciente'],
    '🕉️': ['om', 'om'],
    '☸️': ['wheel', 'dharma', 'rueda', 'dharma'],
    '✡️': ['star', 'david', 'estrella', 'david'],
    '🔯': ['dotted', 'six', 'pointed', 'star', 'estrella', 'puntos'],
    '🕎': ['menorah', 'menorah'],
    '☯️': ['yin', 'yang', 'yin', 'yang'],
    '☦️': ['orthodox', 'cross', 'cruz', 'ortodoxa'],
    '🛐': ['place', 'worship', 'lugar', 'adoracion'],
    '⛎': ['ophiuchus', 'ofiuco'],
    '♈': ['aries', 'aries'],
    '♉': ['taurus', 'tauro'],
    '♊': ['gemini', 'geminis'],
    '♋': ['cancer', 'cancer'],
    '♌': ['leo', 'leo'],
    '♍': ['virgo', 'virgo'],
    '♎': ['libra', 'libra'],
    '♏': ['scorpio', 'escorpio'],
    '♐': ['sagittarius', 'sagitario'],
    '♑': ['capricorn', 'capricornio'],
    '♒': ['aquarius', 'acuario'],
    '♓': ['pisces', 'piscis'],
    '❌': ['cross', 'mark', 'cruz', 'marca', 'no'],
    '⭕': ['heavy', 'large', 'circle', 'circulo', 'grande'],
    '🛑': ['stop', 'sign', 'alto', 'señal'],
    '⛔': ['no', 'entry', 'prohibido', 'entrada'],
    '📛': ['name', 'badge', 'identificacion', 'placa'],
    '🚫': ['prohibited', 'prohibido'],
    '💯': ['hundred', 'points', 'cien', 'puntos', 'perfecto'],
    '💢': ['anger', 'symbol', 'enojo', 'simbolo'],
    '♨️': ['hot', 'springs', 'aguas', 'termales'],
    '🚷': ['no', 'pedestrians', 'prohibido', 'peatones'],
    '🚯': ['no', 'littering', 'prohibido', 'basura'],
    '🚳': ['no', 'bicycles', 'prohibido', 'bicicletas'],
    '🚱': ['non', 'potable', 'water', 'agua', 'no', 'potable'],
    '🔞': ['no', 'one', 'under', 'eighteen', 'prohibido', 'menores'],
    '📵': ['no', 'mobile', 'phones', 'prohibido', 'telefonos'],
    '🚭': ['no', 'smoking', 'prohibido', 'fumar'],
    '❗': ['exclamation', 'mark', 'exclamacion', 'marca'],
    '❓': ['question', 'mark', 'pregunta', 'marca'],
    '❕': ['white', 'exclamation', 'mark', 'exclamacion', 'blanca'],
    '❔': ['white', 'question', 'mark', 'pregunta', 'blanca'],
    '‼️': ['double', 'exclamation', 'mark', 'doble', 'exclamacion'],
    '⁉️': ['exclamation', 'question', 'mark', 'exclamacion', 'pregunta'],
    '🔅': ['dim', 'button', 'boton', 'tenue'],
    '🔆': ['bright', 'button', 'boton', 'brillante'],
    '⚠️': ['warning', 'advertencia'],
    '🚸': ['children', 'crossing', 'niños', 'cruzar'],
    '🔱': ['trident', 'emblem', 'tridente', 'emblema'],
    '⚜️': ['fleur', 'de', 'lis', 'flor', 'lis'],
    '🔰': ['japanese', 'symbol', 'beginner', 'simbolo', 'principiante'],
    '♻️': ['recycling', 'symbol', 'reciclaje', 'simbolo'],
    '🈯': ['japanese', 'reserved', 'button', 'reservado'],
    '💹': ['chart', 'increasing', 'yen', 'grafico', 'aumentando'],
    '❇️': ['sparkle', 'brillante'],
    '✳️': ['eight', 'spoked', 'asterisk', 'asterisco', 'ocho'],
    '❎': ['cross', 'mark', 'button', 'cruz', 'marca', 'boton'],
    '🌐': ['globe', 'meridians', 'globo', 'meridianos'],
    '💠': ['diamond', 'shape', 'diamante', 'forma'],
    'Ⓜ️': ['circled', 'm', 'm', 'circulo'],
    '🌀': ['cyclone', 'ciclón'],
    '💤': ['zzz', 'sueño', 'dormir'],
    '🏧': ['atm', 'sign', 'cajero', 'automatico'],
    '🚾': ['water', 'closet', 'baño', 'wc'],
    '♿': ['wheelchair', 'symbol', 'silla', 'ruedas', 'simbolo'],
    '🅿️': ['p', 'button', 'estacionamiento', 'parking'],
    '🈳': ['japanese', 'vacancy', 'button', 'vacante'],
    '🈂️': ['japanese', 'service', 'charge', 'button', 'servicio'],
    '🛂': ['passport', 'control', 'control', 'pasaporte'],
    '🛃': ['customs', 'aduana'],
    '🛄': ['baggage', 'claim', 'reclamo', 'equipaje'],
    '🛅': ['left', 'luggage', 'equipaje', 'izquierda'],
    '🚹': ['men', 's', 'room', 'hombres', 'baño'],
    '🚺': ['women', 's', 'room', 'mujeres', 'baño'],
    '🚼': ['baby', 'symbol', 'bebe', 'simbolo'],
    '🚻': ['restroom', 'baño', 'sanitario'],
    '🚮': ['litter', 'bin', 'basura', 'papelera'],
    '🎦': ['cinema', 'cine'],
    '📶': ['antenna', 'bars', 'antena', 'barras', 'señal'],
    '🈁': ['japanese', 'here', 'button', 'aqui'],
    '🔣': ['input', 'symbols', 'simbolos', 'entrada'],
    '🔤': ['input', 'latin', 'letters', 'letras', 'latinas'],
    '🔠': ['input', 'latin', 'uppercase', 'mayusculas'],
    '🔡': ['input', 'latin', 'lowercase', 'minusculas'],
    '🔢': ['input', 'numbers', 'numeros'],
    '🔟': ['keycap', 'ten', 'tecla', 'diez'],
    '#️⃣': ['keycap', 'hash', 'tecla', 'numeral'],
    '*️⃣': ['keycap', 'asterisk', 'tecla', 'asterisco'],
    '0️⃣': ['keycap', 'zero', 'tecla', 'cero'],
    '1️⃣': ['keycap', 'one', 'tecla', 'uno'],
    '2️⃣': ['keycap', 'two', 'tecla', 'dos'],
    '3️⃣': ['keycap', 'three', 'tecla', 'tres'],
    '4️⃣': ['keycap', 'four', 'tecla', 'cuatro'],
    '5️⃣': ['keycap', 'five', 'tecla', 'cinco'],
    '6️⃣': ['keycap', 'six', 'tecla', 'seis'],
    '7️⃣': ['keycap', 'seven', 'tecla', 'siete'],
    '8️⃣': ['keycap', 'eight', 'tecla', 'ocho'],
    '9️⃣': ['keycap', 'nine', 'tecla', 'nueve'],
    '🔺': ['red', 'triangle', 'pointed', 'up', 'triangulo', 'rojo', 'arriba'],
    '🔻': ['red', 'triangle', 'pointed', 'down', 'triangulo', 'rojo', 'abajo'],
    '🔸': ['small', 'orange', 'diamond', 'diamante', 'naranja', 'pequeño'],
    '🔹': ['small', 'blue', 'diamond', 'diamante', 'azul', 'pequeño'],
    '🔶': ['large', 'orange', 'diamond', 'diamante', 'naranja', 'grande'],
    '🔷': ['large', 'blue', 'diamond', 'diamante', 'azul', 'grande'],
    '🔳': ['white', 'square', 'button', 'cuadrado', 'blanco', 'boton'],
    '🔲': ['black', 'square', 'button', 'cuadrado', 'negro', 'boton'],
    '▪️': ['black', 'small', 'square', 'cuadrado', 'negro', 'pequeño'],
    '▫️': ['white', 'small', 'square', 'cuadrado', 'blanco', 'pequeño'],
    '◾': ['black', 'medium', 'small', 'square', 'cuadrado', 'negro', 'mediano'],
    '◽': ['white', 'medium', 'small', 'square', 'cuadrado', 'blanco', 'mediano'],
    '◼️': ['black', 'medium', 'square', 'cuadrado', 'negro', 'mediano'],
    '◻️': ['white', 'medium', 'square', 'cuadrado', 'blanco', 'mediano'],
    '🟥': ['red', 'square', 'cuadrado', 'rojo'],
    '🟧': ['orange', 'square', 'cuadrado', 'naranja'],
    '🟨': ['yellow', 'square', 'cuadrado', 'amarillo'],
    '🟩': ['green', 'square', 'cuadrado', 'verde'],
    '🟦': ['blue', 'square', 'cuadrado', 'azul'],
    '🟪': ['purple', 'square', 'cuadrado', 'morado'],
    '🟫': ['brown', 'square', 'cuadrado', 'cafe'],
    '⬛': ['black', 'large', 'square', 'cuadrado', 'negro', 'grande'],
    '⬜': ['white', 'large', 'square', 'cuadrado', 'blanco', 'grande'],
    '🔈': ['speaker', 'low', 'volume', 'altavoz', 'bajo', 'volumen'],
    '🔇': ['muted', 'speaker', 'altavoz', 'silenciado'],
    '🔉': ['speaker', 'medium', 'volume', 'altavoz', 'medio', 'volumen'],
    '🔊': ['speaker', 'high', 'volume', 'altavoz', 'alto', 'volumen'],
    '🔔': ['bell', 'campana'],
    '🔕': ['bell', 'slashed', 'campana', 'tachada'],
    '📣': ['megaphone', 'megafono'],
    '📢': ['loudspeaker', 'altavoz', 'altoparlante'],
    '💬': ['speech', 'balloon', 'burbuja', 'dialogo'],
    '💭': ['thought', 'balloon', 'burbuja', 'pensamiento'],
    '🗯️': ['right', 'anger', 'bubble', 'burbuja', 'enojo', 'derecha'],
    '♠️': ['spade', 'suit', 'pica', 'naipe'],
    '♣️': ['club', 'suit', 'trebol', 'naipe'],
    '♥️': ['heart', 'suit', 'corazon', 'naipe'],
    '♦️': ['diamond', 'suit', 'diamante', 'naipe'],
    '🕐': ['one', 'o', 'clock', 'una', 'hora'],
    '🕑': ['two', 'o', 'clock', 'dos', 'horas'],
    '🕒': ['three', 'o', 'clock', 'tres', 'horas'],
    '🕓': ['four', 'o', 'clock', 'cuatro', 'horas'],
    '🕔': ['five', 'o', 'clock', 'cinco', 'horas'],
    '🕕': ['six', 'o', 'clock', 'seis', 'horas'],
    '🕖': ['seven', 'o', 'clock', 'siete', 'horas'],
    '🕗': ['eight', 'o', 'clock', 'ocho', 'horas'],
    '🕘': ['nine', 'o', 'clock', 'nueve', 'horas'],
    '🕙': ['ten', 'o', 'clock', 'diez', 'horas'],
    '🕚': ['eleven', 'o', 'clock', 'once', 'horas'],
    '🕛': ['twelve', 'o', 'clock', 'doce', 'horas'],
    
    // Banderas (solo algunas comunes)
    '🏳️': ['white', 'flag', 'bandera', 'blanca'],
    '🏴': ['black', 'flag', 'bandera', 'negra'],
    '🏁': ['chequered', 'flag', 'bandera', 'cuadros'],
    '🚩': ['triangular', 'flag', 'bandera', 'triangular'],
    '🏳️‍🌈': ['rainbow', 'flag', 'bandera', 'arcoiris', 'lgbt'],
    '🏳️‍⚧️': ['transgender', 'flag', 'bandera', 'transgenero'],
    '🏴‍☠️': ['pirate', 'flag', 'bandera', 'pirata']
  };

  constructor(
    private cdr: ChangeDetectorRef,
    private taskTypeService: TaskTypeService,
    private taskService: TaskService,
    private taskGroupService: TaskGroupService,
    private renderer: Renderer2
  ) {}

  get formId(): string {
    return this.isEditing ? 'editTaskForm' : 'newTaskForm';
  }
  
  ngOnInit() {
    this.initializeDateTimeFields();
    this.buildEnvironmentOptions();
    this.onEnvironmentChange();
    this.onProjectChange();
    this.checkIfDeadlineExists();
    // Guardar los valores iniciales de fecha/hora de inicio
    this.previousStartDate = this.startDate;
    this.previousStartTime = this.startTime;
    
    // Guardar las fechas originales para el desplazamiento de recordatorios
    if (this.task.start) {
      this.originalStartDateTime = new Date(this.task.start + (this.task.start.includes('Z') ? '' : 'Z'));
    }
    if (this.task.end) {
      this.originalEndDateTime = new Date(this.task.end + (this.task.end.includes('Z') ? '' : 'Z'));
    }
    
    // Sincronizar el primer fragmento con las fechas principales si existe
    this.syncFirstFragmentWithMainDates();
    
    // Configurar suscripción para debounce de cambios en duración
    this.durationChangeSubscription = this.durationChangeSubject
      .pipe(debounceTime(500)) // 500ms de delay, similar a VSCode
      .subscribe((newDuration) => {
        this.recalculateEndTimeFromDuration(newDuration);
      });
  }
  
  ngOnDestroy() {
    // Asegurar que el scroll se desbloquee al destruir el componente
    this.enableBodyScroll();
    // Limpiar el selector de emojis si está abierto
    this.closeEmojiPicker();
    // Desuscribirse del subject de cambios de duración
    if (this.durationChangeSubscription) {
      this.durationChangeSubscription.unsubscribe();
    }
  }
  
  ngAfterViewChecked() {
    // Detectar cuando el selector de proyectos se abre y cerrar el emoji picker
    if (this.projectSelect && this.showEmojiPicker) {
      const currentIsOpen = this.projectSelect.isOpen;
      if (currentIsOpen && !this.previousProjectSelectIsOpen) {
        this.closeEmojiPicker();
      }
      this.previousProjectSelectIsOpen = currentIsOpen;
    }
    
    // Detectar cuando el selector de environment se abre y cerrar el emoji picker
    if (this.environmentSelect && this.showEmojiPicker) {
      const currentIsOpen = this.environmentSelect.isOpen;
      if (currentIsOpen && !this.previousEnvironmentSelectIsOpen) {
        this.closeEmojiPicker();
      }
      this.previousEnvironmentSelectIsOpen = currentIsOpen;
    }
    
    // Detectar cuando el selector de tipo de tarea se abre y cerrar el emoji picker
    if (this.taskTypeSelect && this.showEmojiPicker) {
      const currentIsOpen = this.taskTypeSelect.isOpen;
      if (currentIsOpen && !this.previousTaskTypeSelectIsOpen) {
        this.closeEmojiPicker();
      }
      this.previousTaskTypeSelectIsOpen = currentIsOpen;
    }
  }
  
  async ngOnChanges(changes: any) {
    if (this.showModal) {
      this.disableBodyScroll();
      // Mostrar carga mientras se obtienen los datos
      if (changes.showModal && changes.showModal.currentValue) {
        await this.loadInitialData();
      }
      // Detectar cambios en la lista de proyectos para actualizar los selectores
      if (changes.projects) {
        this.refreshProjects();
      }
    } else {
      this.enableBodyScroll();
      // Limpiar tareas recientes al cerrar
      this.recentTasks = [];
      this.showRecentTasksSelector = false;
      this.showRecentTasksModal = false;
      this.selectedRecentTaskIndex = '';
      this.isLoading = false;
      this.isSaving = false;
      // Cerrar el selector de emojis si está abierto
      this.closeEmojiPicker();
    }
  }
  
  private async loadInitialData() {
    this.isLoading = true;
    
    try {
      // Cargar tipos de tarea siempre
      await this.loadTaskTypes();
      
      // Si hay un proyecto seleccionado, cargar datos relacionados
      if (this.task.project) {
        // Filtrar tipos seleccionables
        this.selectableTaskTypes = this.taskTypes.filter(t => t.projectId === this.task.project);
        
        // Cargar grupos de tareas
        await this.loadTaskGroups();
        
        // Cargar tareas recientes solo si no estamos editando
        if (!this.isEditing) {
          await this.loadRecentTasks();
        }
      } else {
        this.selectableTaskTypes = [];
        this.taskGroups = [];
      }
    } catch (error) {
      console.error('Error al cargar datos iniciales:', error);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }
  
  private disableBodyScroll() {
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    (document.body as any).__scrollY = scrollY;
    document.body.style.paddingRight = this.getScrollbarWidth() + 'px';
  }
  
  private enableBodyScroll() {
    const scrollY = (document.body as any).__scrollY || 0;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.paddingRight = '';
    window.scrollTo(0, scrollY);
    delete (document.body as any).__scrollY;
  }
  
  private getScrollbarWidth(): number {
    // Crear un div invisible para medir el ancho del scrollbar
    const outer = document.createElement('div');
    outer.style.visibility = 'hidden';
    outer.style.overflow = 'scroll';
    (outer.style as any).msOverflowStyle = 'scrollbar';
    document.body.appendChild(outer);

    const inner = document.createElement('div');
    outer.appendChild(inner);

    const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
    outer.parentNode?.removeChild(outer);

    return scrollbarWidth;
  }
  
  private initializeDateTimeFields() {
    if (this.task.start) {
      const startDateTime = this.splitDateTime(this.task.start);
      this.startDate = startDateTime.date;
      this.startTime = startDateTime.time;
    }
    
    if (this.task.end) {
      const endDateTime = this.splitDateTime(this.task.end);
      this.endDate = endDateTime.date;
      this.endTime = endDateTime.time;
    }
    
    if (this.task.deadline) {
      const deadlineDateTime = this.splitDateTime(this.task.deadline);
      this.deadlineDate = deadlineDateTime.date;
      this.deadlineTime = deadlineDateTime.time;
    }
    
    // Si hay fragmentos y fechas principales, sincronizar el primer fragmento
    // Si no hay fechas principales pero sí hay primer fragmento, usar ese para las fechas principales
    if (this.task.fragments && this.task.fragments.length > 0) {
      if (this.startDate && this.startTime && this.endDate && this.endTime) {
        // Hay fechas principales, sincronizar el primer fragmento con ellas
        this.task.fragments[0].start = this.combineDateTime(this.startDate, this.startTime);
        this.task.fragments[0].end = this.combineDateTime(this.endDate, this.endTime);
      } else if (this.task.fragments[0]?.start && this.task.fragments[0]?.end) {
        // No hay fechas principales pero sí hay primer fragmento, usar ese
        const fragmentStart = this.splitDateTime(this.task.fragments[0].start);
        const fragmentEnd = this.splitDateTime(this.task.fragments[0].end);
        this.startDate = fragmentStart.date;
        this.startTime = fragmentStart.time;
        this.endDate = fragmentEnd.date;
        this.endTime = fragmentEnd.time;
      }
    }
  }
  
  closeModal() {
    this.enableBodyScroll();
    this.closeEmojiPicker();
    this.closeRecentTasksModal();
    // Resetear el spinner al cerrar
    this.isSaving = false;
    this.closeModalEvent.emit();
  }
  
  toggleRecentTasksModal() {
    this.showRecentTasksModal = !this.showRecentTasksModal;
  }
  
  closeRecentTasksModal() {
    this.showRecentTasksModal = false;
  }
  
  saveTask() {
    if (!this.isFormValid()) return;
    
    // Activar el estado de guardado
    this.isSaving = true;
    
    // Update task with combined date/time values
    this.task.start = this.combineDateTime(this.startDate, this.startTime);
    this.task.end = this.combineDateTime(this.endDate, this.endTime);
    this.task.deadline = this.deadlineDate && this.deadlineTime 
      ? this.combineDateTime(this.deadlineDate, this.deadlineTime) 
      : null;
    
    this.saveTaskEvent.emit(this.task);
  }
  
  toggleEmojiPicker() {
    if (this.showEmojiPicker) {
      this.closeEmojiPicker();
    } else {
      this.openEmojiPicker();
    }
  }
  
  openEmojiPicker() {
    // Verificar que el botón existe ANTES de cambiar el estado
    if (!this.emojiButton || !this.emojiButton.nativeElement) {
      return;
    }
    
    // Cerrar todos los selectores si están abiertos
    if (this.projectSelect && this.projectSelect.isOpen) {
      this.projectSelect.isOpen = false;
    }
    
    if (this.environmentSelect && this.environmentSelect.isOpen) {
      this.environmentSelect.isOpen = false;
    }
    
    if (this.taskTypeSelect && this.taskTypeSelect.isOpen) {
      this.taskTypeSelect.isOpen = false;
    }
    
    // Cambiar el estado
    this.showEmojiPicker = true;
    
    // Crear el elemento INMEDIATAMENTE sin setTimeout ni detectChanges
    this.createEmojiPickerElement();
  }
  
  closeEmojiPicker() {
    this.showEmojiPicker = false;
    if (this.emojiPickerElement) {
      this.renderer.removeChild(document.body, this.emojiPickerElement);
      this.emojiPickerElement = null;
    }
    if (this.emojiPickerClickListener) {
      this.emojiPickerClickListener();
      this.emojiPickerClickListener = undefined;
    }
    this.emojiGridElement = null;
    this.emojiHeaderElement = null;
    this.emojiSearchInputElement = null;
    // Limpiar estado de búsqueda
    this.emojiSearchQuery = '';
    this.filteredEmojis = [];
  }
  
  handleModalClick(event: MouseEvent) {
    // Cerrar el emoji picker si está abierto y el clic no fue en el picker ni en el botón
    if (this.showEmojiPicker && this.emojiPickerElement) {
      const target = event.target as Node;
      const pickerContains = this.emojiPickerElement.contains(target);
      const buttonContains = this.emojiButton?.nativeElement?.contains(target);
      
      if (!pickerContains && !buttonContains) {
        this.closeEmojiPicker();
      }
    }
    
    // Mantener el stopPropagation para evitar que el clic cierre el modal
    event.stopPropagation();
  }
  
  private createEmojiPickerElement() {
    if (!this.emojiButton || !this.emojiButton.nativeElement) {
      return;
    }
    
    const button = this.emojiButton.nativeElement as HTMLElement;
    const buttonRect = button.getBoundingClientRect();
    
    // Calcular posición PRIMERO
    const pickerWidth = 500;
    const pickerHeight = 380;
    const margin = 8;
    
    let left = buttonRect.left;
    let top = buttonRect.bottom + margin;
    
    // Ajustar si se sale de la pantalla por la derecha
    if (left + pickerWidth > window.innerWidth) {
      left = window.innerWidth - pickerWidth - 16;
    }
    
    // Ajustar si se sale de la pantalla por la izquierda
    if (left < 16) {
      left = 16;
    }
    
    // Ajustar si se sale por abajo (mostrar arriba)
    if (top + pickerHeight > window.innerHeight) {
      top = buttonRect.top - pickerHeight - margin;
    }
    
    // Asegurar que no se salga por arriba
    if (top < 16) {
      top = 16;
    }
    
    // Crear el contenedor del picker
    const picker = this.renderer.createElement('div');
    this.renderer.addClass(picker, 'emoji-picker-portal');
    
    // CRÍTICO: Establecer posición ANTES de crear contenido
    this.renderer.setStyle(picker, 'position', 'fixed');
    this.renderer.setStyle(picker, 'left', `${left}px`);
    this.renderer.setStyle(picker, 'top', `${top}px`);
    this.renderer.setStyle(picker, 'z-index', '10000');
    
    // Prevenir que los clics dentro del picker se propaguen y cierren el picker
    this.renderer.listen(picker, 'click', (event: MouseEvent) => {
      event.stopPropagation();
    });
    
    // Crear el header con el nombre de la categoría
    const header = this.renderer.createElement('div');
    this.renderer.addClass(header, 'emoji-header');
    
    const categoryName = this.renderer.createElement('span');
    categoryName.textContent = this.emojiCategories[this.selectedEmojiCategory].name;
    this.renderer.setStyle(categoryName, 'font-weight', '600');
    this.renderer.setStyle(categoryName, 'font-size', '14px');
    this.renderer.appendChild(header, categoryName);
    
    const closeButton = this.renderer.createElement('button');
    this.renderer.setAttribute(closeButton, 'type', 'button');
    this.renderer.setStyle(closeButton, 'color', '#9ca3af');
    this.renderer.setStyle(closeButton, 'cursor', 'pointer');
    this.renderer.setStyle(closeButton, 'background', 'none');
    this.renderer.setStyle(closeButton, 'border', 'none');
    this.renderer.setStyle(closeButton, 'padding', '0');
    this.renderer.setStyle(closeButton, 'font-size', '16px');
    this.renderer.listen(closeButton, 'click', () => this.closeEmojiPicker());
    this.renderer.listen(closeButton, 'mouseenter', () => {
      this.renderer.setStyle(closeButton, 'color', '#4b5563');
    });
    this.renderer.listen(closeButton, 'mouseleave', () => {
      this.renderer.setStyle(closeButton, 'color', '#9ca3af');
    });
    
    const closeIcon = this.renderer.createElement('i');
    this.renderer.addClass(closeIcon, 'fas');
    this.renderer.addClass(closeIcon, 'fa-times');
    this.renderer.appendChild(closeButton, closeIcon);
    this.renderer.appendChild(header, closeButton);
    this.renderer.appendChild(picker, header);
    this.emojiHeaderElement = header;
    
    // Crear barra de búsqueda
    const searchContainer = this.renderer.createElement('div');
    this.renderer.setStyle(searchContainer, 'padding', '8px 12px');
    this.renderer.setStyle(searchContainer, 'border-bottom', '1px solid #e5e7eb');
    this.renderer.setStyle(searchContainer, 'background', '#ffffff');
    
    const searchInput = this.renderer.createElement('input');
    this.renderer.setAttribute(searchInput, 'type', 'text');
    this.renderer.setAttribute(searchInput, 'placeholder', 'Buscar emoji... / Search emoji...');
    this.renderer.setStyle(searchInput, 'width', '100%');
    this.renderer.setStyle(searchInput, 'padding', '8px 12px');
    this.renderer.setStyle(searchInput, 'border', '1px solid #d1d5db');
    this.renderer.setStyle(searchInput, 'border-radius', '8px');
    this.renderer.setStyle(searchInput, 'font-size', '14px');
    this.renderer.setStyle(searchInput, 'outline', 'none');
    this.renderer.setStyle(searchInput, 'box-sizing', 'border-box');
    this.renderer.setStyle(searchInput, 'transition', 'border-color 0.2s');
    this.renderer.setStyle(searchInput, 'background', '#f9fafb');
    
    // Estilos de focus
    this.renderer.listen(searchInput, 'focus', () => {
      this.renderer.setStyle(searchInput, 'border-color', '#3b82f6');
      this.renderer.setStyle(searchInput, 'background', '#ffffff');
    });
    this.renderer.listen(searchInput, 'blur', () => {
      this.renderer.setStyle(searchInput, 'border-color', '#d1d5db');
      this.renderer.setStyle(searchInput, 'background', '#f9fafb');
    });
    
    // Listener para búsqueda en tiempo real
    this.renderer.listen(searchInput, 'input', (event: any) => {
      this.onEmojiSearch(event.target.value);
    });
    
    // Guardar referencia al input
    this.emojiSearchInputElement = searchInput;
    
    this.renderer.appendChild(searchContainer, searchInput);
    this.renderer.appendChild(picker, searchContainer);
    
    // Crear el grid de emojis de la categoría actual
    const grid = this.renderer.createElement('div');
    this.renderer.addClass(grid, 'emoji-grid');
    
    this.updateEmojiGrid(grid);
    
    this.renderer.appendChild(picker, grid);
    this.emojiGridElement = grid;
    
    // Crear barra de navegación de categorías
    const categoryBar = this.renderer.createElement('div');
    this.renderer.setStyle(categoryBar, 'display', 'flex');
    this.renderer.setStyle(categoryBar, 'gap', '4px');
    this.renderer.setStyle(categoryBar, 'padding', '8px');
    this.renderer.setStyle(categoryBar, 'border-top', '1px solid #f3f4f6');
    this.renderer.setStyle(categoryBar, 'background', '#f9fafb');
    this.renderer.setStyle(categoryBar, 'overflow-x', 'auto');
    this.renderer.setStyle(categoryBar, 'overflow-y', 'hidden');
    this.renderer.setStyle(categoryBar, 'border-radius', '0 0 12px 12px');
    
    this.emojiCategories.forEach((category, index) => {
      const categoryButton = this.renderer.createElement('button');
      this.renderer.setAttribute(categoryButton, 'type', 'button');
      this.renderer.setAttribute(categoryButton, 'data-category-button', 'true');
      this.renderer.setStyle(categoryButton, 'background', index === this.selectedEmojiCategory ? '#dbeafe' : 'transparent');
      this.renderer.setStyle(categoryButton, 'border', 'none');
      this.renderer.setStyle(categoryButton, 'border-radius', '8px');
      this.renderer.setStyle(categoryButton, 'padding', '8px');
      this.renderer.setStyle(categoryButton, 'cursor', 'pointer');
      this.renderer.setStyle(categoryButton, 'font-size', '20px');
      this.renderer.setStyle(categoryButton, 'min-width', '40px');
      this.renderer.setStyle(categoryButton, 'display', 'flex');
      this.renderer.setStyle(categoryButton, 'align-items', 'center');
      this.renderer.setStyle(categoryButton, 'justify-content', 'center');
      this.renderer.setStyle(categoryButton, 'transition', 'background-color 0.2s');
      
      categoryButton.textContent = category.icon;
      
      this.renderer.listen(categoryButton, 'click', () => {
        this.selectedEmojiCategory = index;
        this.updateCategoryContent();
      });
      
      this.renderer.listen(categoryButton, 'mouseenter', () => {
        if (index !== this.selectedEmojiCategory) {
          this.renderer.setStyle(categoryButton, 'background', '#f3f4f6');
        }
      });
      
      this.renderer.listen(categoryButton, 'mouseleave', () => {
        if (index !== this.selectedEmojiCategory) {
          this.renderer.setStyle(categoryButton, 'background', 'transparent');
        }
      });
      
      this.renderer.appendChild(categoryBar, categoryButton);
    });
    
    this.renderer.appendChild(picker, categoryBar);
    
    // Restaurar posición de scroll horizontal de la barra de categorías
    setTimeout(() => {
      categoryBar.scrollLeft = this.categoryBarScrollPosition;
      
      // Guardar posición de scroll horizontal cuando se hace scroll
      this.renderer.listen(categoryBar, 'scroll', () => {
        this.categoryBarScrollPosition = categoryBar.scrollLeft;
      });
    }, 0);
    
    // Agregar al body (ya está completamente posicionado)
    this.renderer.appendChild(document.body, picker);
    this.emojiPickerElement = picker;
    
    // Agregar listener para cerrar al hacer clic fuera
    // Usar setTimeout para asegurar que el elemento esté en el DOM antes de agregar el listener
    setTimeout(() => {
      // Remover listener anterior si existe
      if (this.emojiPickerClickListener) {
        this.emojiPickerClickListener();
      }
      
      // Estrategia: usar el backdrop del modal y el body del document
      // El modal tiene stopPropagation, por lo que debemos escuchar en el backdrop específicamente
      this.emojiPickerClickListener = this.renderer.listen('document', 'click', (event: MouseEvent) => {
        // Verificar que el picker esté abierto
        if (!this.showEmojiPicker || !this.emojiPickerElement) {
          return;
        }
        
        const target = event.target as Node;
        const pickerContains = this.emojiPickerElement.contains(target);
        const buttonContains = button.contains(target);
        
        // Cerrar si el clic fue fuera del picker y fuera del botón que lo abre
        if (!pickerContains && !buttonContains) {
          this.closeEmojiPicker();
        }
      });
    }, 0);
  }
  
  selectEmoji(emoji: string) {
    this.task.emoji = emoji;
    this.closeEmojiPicker();
  }
  
  private updateCategoryContent() {
    if (!this.emojiPickerElement || !this.emojiGridElement || !this.emojiHeaderElement) {
      return;
    }
    
    // Limpiar búsqueda cuando se cambia de categoría
    this.emojiSearchQuery = '';
    this.filteredEmojis = [];
    if (this.emojiSearchInputElement) {
      (this.emojiSearchInputElement as HTMLInputElement).value = '';
    }
    
    // Actualizar el nombre de la categoría en el header
    const categoryNameSpan = this.emojiHeaderElement.querySelector('span');
    if (categoryNameSpan) {
      categoryNameSpan.textContent = this.emojiCategories[this.selectedEmojiCategory].name;
    }
    
    // Actualizar el grid de emojis
    // Limpiar el grid actual
    while (this.emojiGridElement.firstChild) {
      this.renderer.removeChild(this.emojiGridElement, this.emojiGridElement.firstChild);
    }
    
    // Llenar con los emojis de la nueva categoría
    this.updateEmojiGrid(this.emojiGridElement);
    
    // Actualizar el estado visual de los botones de categoría
    const categoryButtons = this.emojiPickerElement.querySelectorAll('[data-category-button]');
    categoryButtons.forEach((button: any, index: number) => {
      if (index === this.selectedEmojiCategory) {
        this.renderer.setStyle(button, 'background', '#dbeafe');
      } else {
        this.renderer.setStyle(button, 'background', 'transparent');
      }
    });
    
    // Resetear el scroll del grid al inicio
    this.emojiGridElement.scrollTop = 0;
  }
  
  private updateEmojiGrid(grid: HTMLElement) {
    const currentCategory = this.emojiCategories[this.selectedEmojiCategory];
    // Eliminar duplicados manteniendo el orden
    const uniqueEmojis = Array.from(new Set(currentCategory.emojis));
    
    uniqueEmojis.forEach(emoji => {
      const emojiOption = this.renderer.createElement('span');
      this.renderer.addClass(emojiOption, 'emoji-option');
      if (this.task.emoji === emoji) {
        this.renderer.addClass(emojiOption, 'selected');
      }
      emojiOption.textContent = emoji;
      this.renderer.listen(emojiOption, 'click', () => {
        this.selectEmoji(emoji);
      });
      this.renderer.appendChild(grid, emojiOption);
    });
  }
  
  // Obtener todos los emojis únicos de todas las categorías
  private getAllUniqueEmojis(): string[] {
    const allEmojis: string[] = [];
    this.emojiCategories.forEach(category => {
      allEmojis.push(...category.emojis);
    });
    return Array.from(new Set(allEmojis));
  }
  
  // Buscar emojis por keywords (bilingüe)
  private searchEmojis(query: string): string[] {
    if (!query || query.trim() === '') {
      return [];
    }
    
    const normalizedQuery = query.toLowerCase().trim();
    const allEmojis = this.getAllUniqueEmojis();
    
    return allEmojis.filter(emoji => {
      const keywords = this.emojiKeywords[emoji] || [];
      return keywords.some(keyword => 
        keyword.toLowerCase().includes(normalizedQuery)
      );
    });
  }
  
  // Manejar búsqueda de emojis
  onEmojiSearch(query: string) {
    this.emojiSearchQuery = query;
    if (query.trim() === '') {
      // Mostrar categoría actual
      this.updateCategoryContent();
    } else {
      // Mostrar resultados filtrados
      this.filteredEmojis = this.searchEmojis(query);
      this.updateEmojiGridWithSearchResults();
    }
  }
  
  // Actualizar grid con resultados de búsqueda
  private updateEmojiGridWithSearchResults() {
    if (!this.emojiPickerElement || !this.emojiGridElement || !this.emojiHeaderElement) {
      return;
    }
    
    // Actualizar el nombre del header a "Resultados de búsqueda"
    const categoryNameSpan = this.emojiHeaderElement.querySelector('span');
    if (categoryNameSpan) {
      categoryNameSpan.textContent = 'Resultados de búsqueda';
    }
    
    // Limpiar el grid actual
    while (this.emojiGridElement.firstChild) {
      this.renderer.removeChild(this.emojiGridElement, this.emojiGridElement.firstChild);
    }
    
    // Llenar con los emojis filtrados
    this.filteredEmojis.forEach(emoji => {
      const emojiOption = this.renderer.createElement('span');
      this.renderer.addClass(emojiOption, 'emoji-option');
      if (this.task.emoji === emoji) {
        this.renderer.addClass(emojiOption, 'selected');
      }
      emojiOption.textContent = emoji;
      this.renderer.listen(emojiOption, 'click', () => {
        this.selectEmoji(emoji);
      });
      this.renderer.appendChild(this.emojiGridElement!, emojiOption);
    });
    
    // Resetear el scroll del grid al inicio
    this.emojiGridElement.scrollTop = 0;
  }
  
  @HostListener('window:resize', ['$event'])
  onResize() {
    if (this.showEmojiPicker && this.emojiPickerElement) {
      // Recalcular posición al redimensionar
      this.closeEmojiPicker();
      setTimeout(() => {
        this.openEmojiPicker();
      }, 100);
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent) {
    // Solo cerrar el modal si está abierto y no hay otros modales abiertos
    if (this.showModal && 
        !this.showEmojiPicker && 
        !this.showRecentTasksModal && 
        !this.showDurationConfirmModal && 
        !this.showFragmentDurationConfirmModal) {
      event.preventDefault();
      this.closeModal();
    }
  }
  
  onEnvironmentChange() {
    if (this.task.environment) {
      this.selectableProjects = this.projects.filter(p => p.environment === this.task.environment);
    } else {
      this.selectableProjects = [];
    }
    this.buildProjectOptions(); // Actualizar opciones de proyecto
    
    const hadProject = !!this.task.project;
    if (!this.selectableProjects.find(p => p.id === this.task.project)) {
      this.task.project = '';
      this.task.type = undefined;
    }
    this.onProjectChange();
    
    // Si se seleccionó un environment, hay proyectos disponibles y no hay proyecto seleccionado,
    // abrir automáticamente el selector de proyecto
    if (this.task.environment && this.selectableProjects.length > 0 && !this.task.project) {
      // OPTIMIZACIÓN: Usar detectChanges + requestAnimationFrame en lugar de setTimeout
      // para evitar bloqueo por múltiples ciclos de change detection
      this.cdr.detectChanges();
      requestAnimationFrame(() => {
        if (this.projectSelect && !this.task.project) {
          this.projectSelect.open();
        }
      });
    }
  }

  async onProjectChange() {
    if (this.task.project) {
      // Deshabilitar selector de tipos mientras carga
      this.isLoadingTaskTypes = true;
      this.selectableTaskTypes = [];
      this.buildTaskTypeOptions();
      
      // OPTIMIZACIÓN: Cargar solo tipos de forma bloqueante, grupos y tareas en paralelo sin bloquear
      // Esperar SOLO a tipos (rápido desde Input)
      await this.loadTaskTypes();
      
      // Cargar grupos en background (no bloqueante)
      this.loadTaskGroups();
      
      // Cargar tareas recientes en paralelo (solo si no estamos editando)
      if (!this.isEditing) {
        this.loadRecentTasks(); // No await - carga en paralelo
      }
      
      this.selectableTaskTypes = this.taskTypes.filter(t => t.projectId === this.task.project);
      this.buildTaskTypeOptions(); // Actualizar opciones de tipo de tarea
      this.isLoadingTaskTypes = false;
    } else {
      this.selectableTaskTypes = [];
      this.buildTaskTypeOptions(); // Actualizar opciones de tipo de tarea
      this.task.type = undefined;
      this.taskGroups = [];
      this.task.taskGroupId = undefined;
      this.recentTasks = [];
      this.showRecentTasksSelector = false;
      this.selectedRecentTaskIndex = '';
      this.isLoadingTaskTypes = false;
    }
    // Si el tipo actual no está en los tipos seleccionables, limpiarlo
    if (this.task.type && !this.selectableTaskTypes.find(t => t.id === this.task.type)) {
      this.task.type = undefined;
    }
    // Si el grupo actual no está en los grupos disponibles, limpiarlo
    if (this.task.taskGroupId && !this.taskGroups.find(g => g.id === this.task.taskGroupId)) {
      this.task.taskGroupId = undefined;
    }
  }

  async loadTaskTypes() {
    try {
      // Si ya tenemos tipos desde el Input, usarlos (instantáneo)
      if (this.allTaskTypes && this.allTaskTypes.length > 0) {
        this.taskTypes = this.allTaskTypes;
        return;
      }
      
      // Fallback: cargar desde Firestore
      this.taskTypes = await this.taskTypeService.getTaskTypes();
    } catch (error) {
      console.error('Error cargando tipos de tarea:', error);
      this.taskTypes = [];
    }
  }

  async loadTaskGroups() {
    if (!this.task.project) {
      this.taskGroups = [];
      return;
    }
    try {
      // Si hay grupos desde el Input, filtrar localmente (instantáneo)
      if (this.allTaskGroups && this.allTaskGroups.length > 0) {
        this.taskGroups = this.allTaskGroups.filter(g => g.projectId === this.task.project);
        return;
      }
      // Fallback: cargar desde Firestore
      this.taskGroups = await this.taskGroupService.getTaskGroupsByProject(this.task.project);
    } catch (error) {
      console.error('Error cargando grupos de tareas:', error);
      this.taskGroups = [];
    }
  }

  async onTaskGroupCreated(group: TaskGroup) {
    // Recargar grupos para incluir el nuevo
    await this.loadTaskGroups();
    // Seleccionar el grupo recién creado
    this.task.taskGroupId = group.id;
  }

  async onTaskGroupDeleted(groupId: string) {
    // Recargar grupos después de eliminar
    await this.loadTaskGroups();
  }

  async refreshTaskTypes() {
    // Si hay tipos actualizados desde el Input, usarlos primero
    if (this.allTaskTypes && this.allTaskTypes.length >= 0) {
      this.taskTypes = this.allTaskTypes;
    } else {
      // Fallback: cargar desde Firestore
      await this.loadTaskTypes();
    }
    // Solo actualizar los tipos seleccionables si hay un proyecto seleccionado
    if (this.task.project) {
      this.selectableTaskTypes = this.taskTypes.filter(t => t.projectId === this.task.project);
    }
    // Actualizar las opciones del dropdown de Android también
    this.buildTaskTypeOptions();
    // Forzar detección de cambios
    this.cdr.detectChanges();
  }

  refreshProjects() {
    // Actualizar los proyectos seleccionables basándose en el ambiente actual
    if (this.task.environment) {
      this.selectableProjects = this.projects.filter(p => p.environment === this.task.environment);
    } else {
      this.selectableProjects = [];
    }
    // Actualizar las opciones del selector de proyectos
    this.buildProjectOptions();
    // Forzar actualización de la vista
    this.cdr.detectChanges();
  }

  async loadRecentTasks() {
    if (!this.task.project || this.isEditing) {
      this.recentTasks = [];
      this.showRecentTasksSelector = false;
      return;
    }

    // Si hay tareas en el Input, filtrar localmente (instantaneo)
    if (this.allTasks && this.allTasks.length > 0) {
      this.recentTasks = this.allTasks
        .filter(t => t.project === this.task.project)
        .sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt).getTime();
          return dateB - dateA; // Mas reciente primero
        })
        .slice(0, 20);
      
      this.showRecentTasksSelector = this.recentTasks.length > 0;
      this.recentTasksOptions = this.buildRecentTasksOptions();
      return;
    }

    // Fallback: cargar desde Firestore
    try {
      this.recentTasks = await this.taskService.getRecentTasksByProject(this.task.project, 20);
      this.showRecentTasksSelector = this.recentTasks.length > 0;
      this.recentTasksOptions = this.buildRecentTasksOptions();
    } catch (error) {
      console.error('Error al cargar tareas recientes:', error);
      this.recentTasks = [];
      this.showRecentTasksSelector = false;
    }
  }

  // Construir opciones para selectores personalizados
  buildEnvironmentOptions(): void {
    this.environmentOptions = this.environments.map(env => ({
      value: env.id || '',
      label: env.emoji ? `${env.emoji} ${env.name}` : env.name
    }));
  }
  
  buildProjectOptions(): void {
    this.projectOptions = this.selectableProjects.map(proj => ({
      value: proj.id || '',
      label: proj.name,
      image: proj.image
    }));
  }
  
  getSelectedProjectImage(): string | undefined {
    if (!this.task.project) return undefined;
    const selectedProject = this.selectableProjects.find(p => p.id === this.task.project);
    return selectedProject?.image;
  }
  
  buildTaskTypeOptions(): void {
    this.taskTypeOptions = [
      { value: '', label: 'Sin tipo' },
      ...this.selectableTaskTypes.map(type => ({
        value: type.id || '',
        label: type.name
      }))
    ];
  }
  
  buildRecentTasksOptions(): SelectOption[] {
    return this.recentTasks.map((task, index) => ({
      value: index,
      label: `${task.emoji || '📝'} ${task.name}`,
      subtitle: this.formatReminderDateTime(task.updatedAt || task.createdAt)
    }));
  }
  
  // Métodos para manejar selecciones desde selectores personalizados (móvil)
  onEnvironmentSelectCustom(option: SelectOption): void {
    this.task.environment = String(option.value);
    this.onEnvironmentChange();
  }
  
  onProjectSelectCustom(option: SelectOption): void {
    this.task.project = String(option.value);
    this.onProjectChange();
  }
  
  onTaskTypeSelectCustom(option: SelectOption): void {
    const value = option.value;
    this.task.type = value === '' ? undefined : String(value);
  }
  
  // Método para manejar la selección desde el selector nativo (desktop)
  onRecentTaskSelectNative(selectedIndex: string) {
    const index = parseInt(selectedIndex, 10);
    if (isNaN(index) || index < 0 || index >= this.recentTasks.length) {
      return;
    }
    
    this.applyRecentTaskData(index);
    // El modal se cierra dentro de applyRecentTaskData
  }
  
  // Método para manejar la selección desde el selector personalizado (móvil)
  onRecentTaskSelect(option: SelectOption) {
    const index = typeof option.value === 'number' ? option.value : parseInt(String(option.value), 10);
    if (isNaN(index) || index < 0 || index >= this.recentTasks.length) {
      return;
    }
    
    this.applyRecentTaskData(index);
    // El modal se cierra dentro de applyRecentTaskData
  }
  
  // Método común para aplicar los datos de la tarea reciente seleccionada
  applyRecentTaskData(index: number) {
    const selectedTask = this.recentTasks[index];
    if (!selectedTask) {
      return;
    }
    
    // Autocompletar todos los campos desde la tarea seleccionada
    this.task.name = selectedTask.name;
    
    // Copiar emoji
    if (selectedTask.emoji) {
      this.task.emoji = selectedTask.emoji;
    }
    
    // Copiar descripción
    if (selectedTask.description) {
      this.task.description = selectedTask.description;
    }
    
    // Copiar prioridad
    if (selectedTask.priority) {
      this.task.priority = selectedTask.priority;
    }
    
    // Copiar tipo (solo si es válido para el proyecto actual)
    if (selectedTask.type && this.task.project) {
      const isValidType = this.selectableTaskTypes.some(t => t.id === selectedTask.type);
      if (isValidType) {
        this.task.type = selectedTask.type;
      }
    }
    
    // Copiar duración y ajustar fecha/hora de fin si hay fecha/hora de inicio
    if (selectedTask.duration) {
      this.task.duration = selectedTask.duration;
      
      // Si hay fecha/hora de inicio definidas, ajustar automáticamente la fecha/hora de fin
      if (this.startDate && this.startTime) {
        const newEndDateTime = this.calculateNewEndDateTime(this.startDate, this.startTime, selectedTask.duration);
        this.endDate = newEndDateTime.date;
        this.endTime = newEndDateTime.time;
        // Validar las fechas después del ajuste
        this.validateDates();
      }
    }
    
    // Copiar recordatorios si existen, ajustándolos para mantener la distancia relativa
    if (selectedTask.reminders && selectedTask.reminders.length > 0) {
      // Solo copiar si hay fechas de inicio y fin definidas en ambas tareas
      if (this.startDate && this.startTime && this.endDate && this.endTime && 
          selectedTask.start && selectedTask.end) {
        this.task.reminders = this.copyRemindersWithRelativeDistance(
          selectedTask.reminders,
          selectedTask.start,
          selectedTask.end,
          this.startDate,
          this.startTime,
          this.endDate,
          this.endTime
        );
      } else {
        // Si no hay fechas completas, copiar sin ajustar
        this.task.reminders = [...selectedTask.reminders];
      }
    }
    
    // Resetear el selector para permitir seleccionar otra tarea
    this.selectedRecentTaskIndex = '';
    
    // Cerrar el modal de tareas recientes después de aplicar
    this.closeRecentTasksModal();
    
    // Forzar actualización de la vista
    this.cdr.detectChanges();
  }
  
  onDateChange(field: 'start' | 'end' | 'deadline', date: string) {
    if (field === 'start' && this.shouldShowDurationConfirmModal()) {
      // Guardar los valores pendientes
      this.pendingStartDate = date;
      this.pendingStartTime = this.startTime;
      
      // Calcular la nueva fecha/hora de fin manteniendo la duración
      const newEndDateTime = this.calculateNewEndDateTime(date, this.startTime, this.task.duration || 0);
      this.calculatedEndDate = newEndDateTime.date;
      this.calculatedEndTime = newEndDateTime.time;
      
      // Mostrar el modal
      this.showDurationConfirmModal = true;
    } else {
      // Comportamiento normal para otros campos
      if (field === 'start') {
        this.startDate = date;
        // Sincronizar con el primer fragmento si existe
        this.syncFirstFragmentStart();
        // Si no se muestra el modal, ajustar recordatorios directamente
        if (!this.shouldShowDurationConfirmModal() && this.task.reminders && this.task.reminders.length > 0) {
          this.adjustReminders(date, this.startTime, this.endDate, this.endTime);
        }
      } else if (field === 'end') {
        this.endDate = date;
        // Sincronizar con el primer fragmento si existe
        this.syncFirstFragmentEnd();
      }
      this.updateDuration();
      this.validateDates();
    }
  }
  
  onStartTimeChange(time: string) {
    if (this.shouldShowDurationConfirmModal()) {
      // Guardar los valores pendientes
      this.pendingStartDate = this.startDate;
      this.pendingStartTime = time;
      
      // Calcular la nueva fecha/hora de fin manteniendo la duración
      const newEndDateTime = this.calculateNewEndDateTime(this.startDate, time, this.task.duration || 0);
      this.calculatedEndDate = newEndDateTime.date;
      this.calculatedEndTime = newEndDateTime.time;
      
      // Mostrar el modal
      this.showDurationConfirmModal = true;
    } else {
      // Comportamiento normal
      this.startTime = time;
      // Sincronizar con el primer fragmento si existe
      this.syncFirstFragmentStart();
      // Si no se muestra el modal, ajustar recordatorios directamente
      if (!this.shouldShowDurationConfirmModal() && this.task.reminders && this.task.reminders.length > 0 && this.startDate) {
        this.adjustReminders(this.startDate, time, this.endDate, this.endTime);
      }
      this.updateDuration();
      this.validateDates();
    }
  }
  
  onEndTimeChange(time: string) {
    this.endTime = time;
    // Sincronizar con el primer fragmento si existe
    this.syncFirstFragmentEnd();
    this.updateDuration();
    this.validateDates();
  }
  
  onDeadlineTimeChange(time: string) {
    this.deadlineTime = time;
  }
  
  private updateDuration() {
    const duration = this.calculateDuration(this.startDate, this.startTime, this.endDate, this.endTime);
    this.task.duration = duration;
  }
  
  private validateDates(): boolean {
    this.dateError = '';
    
    if (!this.startDate || !this.startTime || !this.endDate || !this.endTime) {
      return true;
    }
    
    const startDateTime = new Date(`${this.startDate}T${this.startTime}`);
    const endDateTime = new Date(`${this.endDate}T${this.endTime}`);
    
    if (endDateTime <= startDateTime) {
      this.dateError = 'La fecha de fin debe ser posterior a la fecha de inicio';
      return false;
    }
    
    return true;
  }
  
  isFormValid(): boolean {
    return this.validateDates() && 
           !!this.task.name && 
           !!this.startDate && 
           !!this.startTime && 
           !!this.endDate && 
           !!this.endTime;
  }
  
  getCurrentTime(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  addFragment() {
    if (!this.task.fragments) {
      this.task.fragments = [];
    }
    
    // Si es el primer clic (no hay fragmentos), crear automáticamente DOS fragmentos
    if (this.task.fragments.length === 0 && this.startDate && this.startTime && this.endDate && this.endTime) {
      // Primer fragmento: usar fechas principales de inicio y fin de la tarea
      const firstFragment = {
        start: this.combineDateTime(this.startDate, this.startTime),
        end: this.combineDateTime(this.endDate, this.endTime)
      };
      this.task.fragments.push(firstFragment);
      
      // Calcular la duración del primer fragmento
      const firstFragmentDuration = this.calculateFragmentDuration(0);
      
      // Segundo fragmento: comienza donde termina el primero, con la misma duración
      const firstFragmentEnd = this.splitDateTime(firstFragment.end);
      const secondFragmentEnd = this.calculateNewEndDateTime(
        firstFragmentEnd.date,
        firstFragmentEnd.time,
        firstFragmentDuration
      );
      
      this.task.fragments.push({
        start: firstFragment.end,
        end: this.combineDateTime(secondFragmentEnd.date, secondFragmentEnd.time)
      });
      
      return;
    }
    
    // Para fragmentos posteriores (tercero, cuarto, etc.)
    if (this.task.fragments.length > 0) {
      // Obtener el último fragmento
      const lastFragmentIndex = this.task.fragments.length - 1;
      const lastFragment = this.task.fragments[lastFragmentIndex];
      
      if (!lastFragment.start || !lastFragment.end) {
        return;
      }
      
      // Calcular la duración del último fragmento
      const lastFragmentDuration = this.calculateFragmentDuration(lastFragmentIndex);
      
      if (lastFragmentDuration <= 0) {
        return;
      }
      
      // El nuevo fragmento comienza donde termina el último
      const lastFragmentEnd = this.splitDateTime(lastFragment.end);
      
      // Calcular la fecha/hora de fin del nuevo fragmento con la misma duración
      const newFragmentEnd = this.calculateNewEndDateTime(
        lastFragmentEnd.date,
        lastFragmentEnd.time,
        lastFragmentDuration
      );
      
      this.task.fragments.push({
        start: lastFragment.end,
        end: this.combineDateTime(newFragmentEnd.date, newFragmentEnd.time)
      });
    }
  }

  private roundTimeToNearest30Minutes(time: string): string {
    if (!time) return '00:00';
    
    const [hours, minutes] = time.split(':').map(Number);
    const roundedMinutes = Math.round(minutes / 30) * 30;
    
    // Si los minutos redondeados son 60, incrementar la hora y poner minutos en 0
    let finalHours = hours;
    let finalMinutes = roundedMinutes;
    
    if (roundedMinutes === 60) {
      finalHours = (hours + 1) % 24;
      finalMinutes = 0;
    }
    
    return `${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
  }
  
  removeFragment(index: number) {
    if (this.task.fragments) {
      this.task.fragments.splice(index, 1);
      // Si se eliminó el primer fragmento y ahora hay otro, ese pasa a ser el primero
      // No modificamos las fechas principales para evitar pérdida de datos
    }
  }

  // Métodos para manejar fecha/hora de fragmentos
  getFragmentStartDate(fragmentIndex: number): string {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]?.start) {
      return '';
    }
    return this.splitDateTime(this.task.fragments[fragmentIndex].start).date;
  }

  getFragmentStartTime(fragmentIndex: number): string {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]?.start) {
      return '';
    }
    return this.splitDateTime(this.task.fragments[fragmentIndex].start).time;
  }

  getFragmentEndDate(fragmentIndex: number): string {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]?.end) {
      return '';
    }
    return this.splitDateTime(this.task.fragments[fragmentIndex].end).date;
  }

  getFragmentEndTime(fragmentIndex: number): string {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]?.end) {
      return '';
    }
    return this.splitDateTime(this.task.fragments[fragmentIndex].end).time;
  }

  onFragmentStartDateChange(fragmentIndex: number, date: string) {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]) {
      return;
    }
    
    // Si es el primer fragmento, sincronizar con fechas principales
    if (fragmentIndex === 0 && !this.isSyncingFragment) {
      this.startDate = date;
      this.onDateChange('start', date);
      return;
    }
    
    // Para otros fragmentos, mostrar modal de confirmación si corresponde
    if (this.shouldShowFragmentDurationConfirmModal(fragmentIndex)) {
      const currentTime = this.getFragmentStartTime(fragmentIndex) || '00:00';
      this.pendingFragmentIndex = fragmentIndex;
      this.pendingFragmentStartDate = date;
      this.pendingFragmentStartTime = currentTime;
      
      // Calcular la nueva fecha/hora de fin manteniendo la duración
      const fragmentDuration = this.calculateFragmentDuration(fragmentIndex);
      const newEndDateTime = this.calculateNewEndDateTime(date, currentTime, fragmentDuration);
      this.calculatedFragmentEndDate = newEndDateTime.date;
      this.calculatedFragmentEndTime = newEndDateTime.time;
      
      this.showFragmentDurationConfirmModal = true;
    } else {
      const currentTime = this.getFragmentStartTime(fragmentIndex) || '00:00';
      this.task.fragments[fragmentIndex].start = this.combineDateTime(date, currentTime);
    }
  }

  onFragmentStartTimeChange(fragmentIndex: number, time: string) {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]) {
      return;
    }
    
    // Si es el primer fragmento, sincronizar con fechas principales
    if (fragmentIndex === 0 && !this.isSyncingFragment) {
      this.startTime = time;
      this.onStartTimeChange(time);
      return;
    }
    
    // Para otros fragmentos, mostrar modal de confirmación si corresponde
    if (this.shouldShowFragmentDurationConfirmModal(fragmentIndex)) {
      const currentDate = this.getFragmentStartDate(fragmentIndex) || new Date().toISOString().split('T')[0];
      this.pendingFragmentIndex = fragmentIndex;
      this.pendingFragmentStartDate = currentDate;
      this.pendingFragmentStartTime = time;
      
      // Calcular la nueva fecha/hora de fin manteniendo la duración
      const fragmentDuration = this.calculateFragmentDuration(fragmentIndex);
      const newEndDateTime = this.calculateNewEndDateTime(currentDate, time, fragmentDuration);
      this.calculatedFragmentEndDate = newEndDateTime.date;
      this.calculatedFragmentEndTime = newEndDateTime.time;
      
      this.showFragmentDurationConfirmModal = true;
    } else {
      const currentDate = this.getFragmentStartDate(fragmentIndex) || new Date().toISOString().split('T')[0];
      this.task.fragments[fragmentIndex].start = this.combineDateTime(currentDate, time);
    }
  }

  onFragmentEndDateChange(fragmentIndex: number, date: string) {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]) {
      return;
    }
    
    // Si es el primer fragmento, sincronizar con fechas principales
    if (fragmentIndex === 0 && !this.isSyncingFragment) {
      this.endDate = date;
      this.onDateChange('end', date);
      return;
    }
    
    const currentTime = this.getFragmentEndTime(fragmentIndex) || '00:00';
    this.task.fragments[fragmentIndex].end = this.combineDateTime(date, currentTime);
  }

  onFragmentEndTimeChange(fragmentIndex: number, time: string) {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]) {
      return;
    }
    
    // Si es el primer fragmento, sincronizar con fechas principales
    if (fragmentIndex === 0 && !this.isSyncingFragment) {
      this.endTime = time;
      this.onEndTimeChange(time);
      return;
    }
    
    const currentDate = this.getFragmentEndDate(fragmentIndex) || new Date().toISOString().split('T')[0];
    this.task.fragments[fragmentIndex].end = this.combineDateTime(currentDate, time);
  }
  
  openTimeCalculator(type: 'start' | 'end') {
    this.openCalculatorModal.emit({ type });
  }
  
  /**
   * Aplica el cálculo de tiempo desde el modal de calculadora
   * @param type 'start' para calcular hora de inicio desde hora de fin, 'end' para calcular hora de fin desde hora de inicio
   * @param minutes Duración en minutos a sumar/restar
   */
  applyTimeCalculation(type: 'start' | 'end', minutes: number) {
    if (type === 'start') {
      // Calcular hora de inicio restando minutos de la hora de fin
      if (this.endDate && this.endTime) {
        // Crear fecha de fin usando el mismo método que combineDateTime
        const [endHours, endMinutes] = this.endTime.split(':').map(Number);
        const endYear = parseInt(this.endDate.substring(0, 4));
        const endMonth = parseInt(this.endDate.substring(5, 7)) - 1;
        const endDay = parseInt(this.endDate.substring(8, 10));
        
        const endDateTime = new Date(endYear, endMonth, endDay, endHours, endMinutes, 0, 0);
        const startDateTime = new Date(endDateTime.getTime() - (minutes * 60 * 1000));
        
        // Extraer fecha y hora usando métodos locales (no UTC) para mantener consistencia
        const newStartDate = `${startDateTime.getFullYear()}-${String(startDateTime.getMonth() + 1).padStart(2, '0')}-${String(startDateTime.getDate()).padStart(2, '0')}`;
        const newStartTime = `${String(startDateTime.getHours()).padStart(2, '0')}:${String(startDateTime.getMinutes()).padStart(2, '0')}`;
        
        // Actualizar las fechas usando los métodos existentes para mantener la sincronización
        this.startDate = newStartDate;
        this.startTime = newStartTime;
        
        // Sincronizar con el primer fragmento si existe
        this.syncFirstFragmentStart();
        
        // Actualizar la duración estimada basándose en las nuevas fechas
        this.updateDuration();
        
        // Validar las fechas
        this.validateDates();
        
        // Forzar actualización de la vista
        this.cdr.detectChanges();
      }
    } else {
      // Calcular hora de fin sumando minutos a la hora de inicio
      if (this.startDate && this.startTime) {
        // Crear fecha de inicio usando el mismo método que combineDateTime
        const [startHours, startMinutes] = this.startTime.split(':').map(Number);
        const startYear = parseInt(this.startDate.substring(0, 4));
        const startMonth = parseInt(this.startDate.substring(5, 7)) - 1;
        const startDay = parseInt(this.startDate.substring(8, 10));
        
        const startDateTime = new Date(startYear, startMonth, startDay, startHours, startMinutes, 0, 0);
        const endDateTime = new Date(startDateTime.getTime() + (minutes * 60 * 1000));
        
        // Extraer fecha y hora usando métodos locales (no UTC) para mantener consistencia
        const newEndDate = `${endDateTime.getFullYear()}-${String(endDateTime.getMonth() + 1).padStart(2, '0')}-${String(endDateTime.getDate()).padStart(2, '0')}`;
        const newEndTime = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`;
        
        // Actualizar las fechas usando los métodos existentes para mantener la sincronización
        this.endDate = newEndDate;
        this.endTime = newEndTime;
        
        // Sincronizar con el primer fragmento si existe
        this.syncFirstFragmentEnd();
        
        // Actualizar la duración estimada basándose en las nuevas fechas
        this.updateDuration();
        
        // Validar las fechas
        this.validateDates();
        
        // Forzar actualización de la vista
        this.cdr.detectChanges();
      }
    }
  }
  
  // Métodos de utilidad
  private combineDateTime(date: string, time: string): string {
    if (!date || !time) return '';
    const [hours, minutes] = time.split(':');
    
    const year = parseInt(date.substring(0, 4));
    const month = parseInt(date.substring(5, 7)) - 1;
    const day = parseInt(date.substring(8, 10));
    
    const dateTime = new Date(year, month, day, parseInt(hours), parseInt(minutes), 0, 0);
    
    return dateTime.toISOString().slice(0, 16);
  }
  
  private splitDateTime(dateTimeString: string): { date: string, time: string } {
    if (!dateTimeString) return { date: '', time: '' };
    
    const dateTime = new Date(dateTimeString + (dateTimeString.includes('Z') ? '' : 'Z'));
    
    const year = dateTime.getFullYear();
    const month = String(dateTime.getMonth() + 1).padStart(2, '0');
    const day = String(dateTime.getDate()).padStart(2, '0');
    const hours = String(dateTime.getHours()).padStart(2, '0');
    const minutes = String(dateTime.getMinutes()).padStart(2, '0');
    
    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`
    };
  }
  
  private formatDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
  
  private calculateDuration(startDate: string, startTime: string, endDate: string, endTime: string): number {
    if (!startDate || !startTime || !endDate || !endTime) {
      return 0;
    }
    
    try {
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      
      const startDateTime = new Date(startDate);
      startDateTime.setHours(startHours, startMinutes, 0, 0);
      
      const endDateTime = new Date(endDate);
      endDateTime.setHours(endHours, endMinutes, 0, 0);
      
      const diffMs = endDateTime.getTime() - startDateTime.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      return Math.max(0, Math.round(diffHours * 100) / 100);
    } catch (error) {
      console.error('Error calculating duration:', error);
      return 0;
    }
  }
  
  getTaskReferenceDates() {
    // Usar las fechas actuales del formulario, no las originales de la tarea
    return {
      start: this.combineDateTime(this.startDate, this.startTime),
      end: this.combineDateTime(this.endDate, this.endTime),
      deadline: this.deadlineDate && this.deadlineTime 
        ? this.combineDateTime(this.deadlineDate, this.deadlineTime) 
        : null
    };
  }
  
  get currentCategorizedReminders(): {
    beforeStart: Array<{ reminder: string; index: number; description: string }>;
    duringEvent: Array<{ reminder: string; index: number; description: string }>;
    beforeDeadline: Array<{ reminder: string; index: number; description: string }>;
    afterDeadline: Array<{ reminder: string; index: number; description: string }>;
  } {
    const reminders = this.task.reminders || [];
    const dates = this.getTaskReferenceDates();
    
    // Asegurar que todas las fechas se interpreten como UTC
    const startDate = dates.start ? new Date(dates.start + (dates.start.includes('Z') ? '' : 'Z')) : null;
    const endDate = dates.end ? new Date(dates.end + (dates.end.includes('Z') ? '' : 'Z')) : null;
    const deadlineDate = dates.deadline ? new Date(dates.deadline + (dates.deadline.includes('Z') ? '' : 'Z')) : null;

    const categorized = {
      beforeStart: [] as Array<{reminder: string, index: number, description: string}>,
      duringEvent: [] as Array<{reminder: string, index: number, description: string}>,
      beforeDeadline: [] as Array<{reminder: string, index: number, description: string}>,
      afterDeadline: [] as Array<{reminder: string, index: number, description: string}>
    };

    reminders.forEach((reminder, index) => {
      // Asegurar que el recordatorio se interprete como UTC
      const reminderDate = new Date(reminder + (reminder.includes('Z') ? '' : 'Z'));
      const description = this.generateReminderDescription(reminderDate, dates);
      
      if (startDate && reminderDate < startDate) {
        // Antes del inicio del evento
        categorized.beforeStart.push({reminder, index, description});
      } else if (endDate && reminderDate <= endDate) {
        // Durante el evento (entre inicio y fin)
        categorized.duringEvent.push({reminder, index, description});
      } else if (deadlineDate && endDate && reminderDate > endDate && reminderDate <= deadlineDate) {
        // Entre el fin del evento y la fecha límite
        categorized.beforeDeadline.push({reminder, index, description});
      } else if (deadlineDate && reminderDate > deadlineDate) {
        // Después de la fecha límite
        categorized.afterDeadline.push({reminder, index, description});
      } else {
        // Si no hay fecha límite pero está después del fin, va a "durante el evento"
        categorized.duringEvent.push({reminder, index, description});
      }
    });

    return categorized;
  }

  private generateReminderDescription(reminderDate: Date, dates: any): string {
    // Asegurar que todas las fechas se interpreten como UTC
    const startDate = dates.start ? new Date(dates.start + (dates.start.includes('Z') ? '' : 'Z')) : null;
    const endDate = dates.end ? new Date(dates.end + (dates.end.includes('Z') ? '' : 'Z')) : null;
    const deadlineDate = dates.deadline ? new Date(dates.deadline + (dates.deadline.includes('Z') ? '' : 'Z')) : null;

    // Función helper para comparar fechas (considerando diferencias menores a 1 minuto como iguales)
    const isSameTime = (date1: Date, date2: Date): boolean => {
      return Math.abs(date1.getTime() - date2.getTime()) < 60000; // Menos de 1 minuto
    };

    // Verificar si coincide exactamente con alguna fecha del evento
    if (startDate && isSameTime(reminderDate, startDate)) {
      return '🎯 Al inicio';
    }
    
    if (endDate && isSameTime(reminderDate, endDate)) {
      return '🏁 Al final';
    }
    
    if (deadlineDate && isSameTime(reminderDate, deadlineDate)) {
      return '⏰ Al límite';
    }

    // Lógica existente para recordatorios que no coinciden exactamente
    if (deadlineDate && endDate && reminderDate > endDate) {
      if (reminderDate <= deadlineDate) {
        const diffMinutes = Math.floor((deadlineDate.getTime() - reminderDate.getTime()) / (1000 * 60));
        return this.formatTimeDifference(diffMinutes, 'antes del límite');
      } else {
        const diffMinutes = Math.floor((reminderDate.getTime() - deadlineDate.getTime()) / (1000 * 60));
        return this.formatTimeDifference(diffMinutes, 'después del límite');
      }
    }
    
    if (startDate && reminderDate < startDate) {
      const diffMinutes = Math.floor((startDate.getTime() - reminderDate.getTime()) / (1000 * 60));
      return this.formatTimeDifference(diffMinutes, 'antes del inicio');
    } else if (endDate && reminderDate > endDate && !deadlineDate) {
      const diffMinutes = Math.floor((reminderDate.getTime() - endDate.getTime()) / (1000 * 60));
      return this.formatTimeDifference(diffMinutes, 'después del final');
    } else if (startDate && endDate && reminderDate >= startDate && reminderDate <= endDate) {
      // Recordatorio durante el evento (entre inicio y final)
      const diffMinutes = Math.floor((reminderDate.getTime() - startDate.getTime()) / (1000 * 60));
      if (diffMinutes === 0) {
        return '🎯 Al inicio';
      } else {
        return this.formatTimeDifference(diffMinutes, 'después del inicio');
      }
    } else if (startDate) {
      const diffMinutes = Math.floor((reminderDate.getTime() - startDate.getTime()) / (1000 * 60));
      return this.formatTimeDifference(Math.abs(diffMinutes), diffMinutes >= 0 ? 'después del inicio' : 'antes del inicio');
    }
    
    return 'Recordatorio personalizado';
  }

  private formatTimeDifference(minutes: number, context: string): string {
    if (minutes < 60) {
      return `${minutes} minutos ${context}`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours} hora${hours > 1 ? 's' : ''} ${context}`;
      } else {
        return `${hours}h ${remainingMinutes}m ${context}`;
      }
    } else {
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      if (remainingHours === 0) {
        return `${days} día${days > 1 ? 's' : ''} ${context}`;
      } else {
        return `${days}d ${remainingHours}h ${context}`;
      }
    }
  }
  
  formatReminderDateTime(dateTimeString: string): string {
    const utcString = dateTimeString.includes('Z') || dateTimeString.includes('+') 
      ? dateTimeString 
      : dateTimeString + 'Z';
    
    const date = new Date(utcString);
    
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Mexico_City'
    });
  }
  
  toggleDeadlineSection() {
    this.showDeadlineSection = !this.showDeadlineSection;
    // Si se oculta la sección, limpiar los valores de fecha límite
    if (!this.showDeadlineSection) {
      this.deadlineDate = '';
      this.deadlineTime = '';
      this.task.deadline = null;
    }
  }
  
  private checkIfDeadlineExists() {
    // Si la tarea ya tiene una fecha límite, mostrar la sección
    if (this.task.deadline) {
      this.showDeadlineSection = true;
    }
  }
  
  // Métodos para el modal de confirmación de duración
  formatDuration(hours: number): string {
    if (hours === 0) return '0 horas';
    
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    if (minutes === 0) {
      return `${wholeHours} hora${wholeHours !== 1 ? 's' : ''}`;
    } else if (wholeHours === 0) {
      return `${minutes} minutos`;
    } else {
      return `${wholeHours} hora${wholeHours !== 1 ? 's' : ''} y ${minutes} minutos`;
    }
  }
  
  formatDateTime(date: string, time: string): string {
    if (!date || !time) return 'No definida';
    
    const dateTime = new Date(`${date}T${time}`);
    return dateTime.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
  
  cancelDurationAdjustment() {
    // Cerrar el modal sin hacer cambios
    this.showDurationConfirmModal = false;
    // Aplicar los cambios de fecha/hora de inicio sin ajustar el fin
    this.startDate = this.pendingStartDate;
    this.startTime = this.pendingStartTime;
    // Ajustar los recordatorios con el nuevo inicio
    this.adjustReminders(this.pendingStartDate, this.pendingStartTime, this.endDate, this.endTime);
    // Recalcular la duración con las nuevas fechas
    this.updateDuration();
    this.validateDates();
  }
  
  confirmDurationAdjustment() {
    // Aplicar los cambios manteniendo la duración
    this.showDurationConfirmModal = false;
    this.startDate = this.pendingStartDate;
    this.startTime = this.pendingStartTime;
    this.endDate = this.calculatedEndDate;
    this.endTime = this.calculatedEndTime;
    // Sincronizar con el primer fragmento si existe
    this.syncFirstFragmentWithMainDates();
    // Ajustar los recordatorios con el nuevo inicio
    this.adjustReminders(this.pendingStartDate, this.pendingStartTime, this.calculatedEndDate, this.calculatedEndTime);
    // La duración se mantiene igual
    this.validateDates();
  }
  
  // Métodos para sincronizar el primer fragmento con las fechas principales
  private syncFirstFragmentWithMainDates() {
    if (!this.task.fragments || this.task.fragments.length === 0) {
      return;
    }
    
    // Si hay fecha/hora de inicio y fin principales, sincronizar con el primer fragmento
    if (this.startDate && this.startTime && this.endDate && this.endTime) {
      this.task.fragments[0].start = this.combineDateTime(this.startDate, this.startTime);
      this.task.fragments[0].end = this.combineDateTime(this.endDate, this.endTime);
    } else if (this.task.fragments[0]?.start && this.task.fragments[0]?.end) {
      // Si no hay fechas principales pero sí hay primer fragmento, sincronizar hacia las fechas principales
      const fragmentStart = this.splitDateTime(this.task.fragments[0].start);
      const fragmentEnd = this.splitDateTime(this.task.fragments[0].end);
      this.startDate = fragmentStart.date;
      this.startTime = fragmentStart.time;
      this.endDate = fragmentEnd.date;
      this.endTime = fragmentEnd.time;
    }
  }
  
  private syncFirstFragmentStart() {
    if (this.isSyncingFragment || !this.task.fragments || this.task.fragments.length === 0) {
      return;
    }
    
    if (this.startDate && this.startTime) {
      this.isSyncingFragment = true;
      this.task.fragments[0].start = this.combineDateTime(this.startDate, this.startTime);
      this.isSyncingFragment = false;
    }
  }
  
  private syncFirstFragmentEnd() {
    if (this.isSyncingFragment || !this.task.fragments || this.task.fragments.length === 0) {
      return;
    }
    
    if (this.endDate && this.endTime) {
      this.isSyncingFragment = true;
      this.task.fragments[0].end = this.combineDateTime(this.endDate, this.endTime);
      this.isSyncingFragment = false;
    }
  }
  
  // Métodos para el modal de confirmación de duración de fragmentos
  private shouldShowFragmentDurationConfirmModal(fragmentIndex: number): boolean {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]) {
      return false;
    }
    
    const fragment = this.task.fragments[fragmentIndex];
    const fragmentDuration = this.calculateFragmentDuration(fragmentIndex);
    
    // Mostrar el modal solo si hay una duración definida mayor a 0 y hay fecha/hora de inicio y fin
    return fragmentDuration > 0 && 
           !!fragment.start && !!fragment.end;
  }
  
  calculateFragmentDuration(fragmentIndex: number): number {
    if (!this.task.fragments || !this.task.fragments[fragmentIndex]) {
      return 0;
    }
    
    const fragment = this.task.fragments[fragmentIndex];
    if (!fragment.start || !fragment.end) {
      return 0;
    }
    
    const startDateTime = this.splitDateTime(fragment.start);
    const endDateTime = this.splitDateTime(fragment.end);
    
    return this.calculateDuration(
      startDateTime.date,
      startDateTime.time,
      endDateTime.date,
      endDateTime.time
    );
  }
  
  getTotalFragmentsDuration(): number {
    if (!this.task.fragments || this.task.fragments.length === 0) {
      return 0;
    }
    
    let totalDuration = 0;
    for (let i = 0; i < this.task.fragments.length; i++) {
      totalDuration += this.calculateFragmentDuration(i);
    }
    
    return totalDuration;
  }
  
  formatTotalFragmentsDuration(): string {
    const totalDuration = this.getTotalFragmentsDuration();
    return this.formatDuration(totalDuration);
  }
  
  cancelFragmentDurationAdjustment() {
    if (this.pendingFragmentIndex === null) {
      return;
    }
    
    // Cerrar el modal sin hacer cambios
    this.showFragmentDurationConfirmModal = false;
    
    // Aplicar los cambios de fecha/hora de inicio sin ajustar el fin
    if (this.task.fragments && this.task.fragments[this.pendingFragmentIndex]) {
      this.task.fragments[this.pendingFragmentIndex].start = this.combineDateTime(
        this.pendingFragmentStartDate,
        this.pendingFragmentStartTime
      );
    }
    
    // Limpiar valores pendientes
    this.pendingFragmentIndex = null;
    this.pendingFragmentStartDate = '';
    this.pendingFragmentStartTime = '';
    this.calculatedFragmentEndDate = '';
    this.calculatedFragmentEndTime = '';
  }
  
  confirmFragmentDurationAdjustment() {
    if (this.pendingFragmentIndex === null) {
      return;
    }
    
    // Aplicar los cambios manteniendo la duración
    this.showFragmentDurationConfirmModal = false;
    
    if (this.task.fragments && this.task.fragments[this.pendingFragmentIndex]) {
      this.task.fragments[this.pendingFragmentIndex].start = this.combineDateTime(
        this.pendingFragmentStartDate,
        this.pendingFragmentStartTime
      );
      this.task.fragments[this.pendingFragmentIndex].end = this.combineDateTime(
        this.calculatedFragmentEndDate,
        this.calculatedFragmentEndTime
      );
    }
    
    // Limpiar valores pendientes
    this.pendingFragmentIndex = null;
    this.pendingFragmentStartDate = '';
    this.pendingFragmentStartTime = '';
    this.calculatedFragmentEndDate = '';
    this.calculatedFragmentEndTime = '';
    
    // Forzar actualización de la vista
    this.cdr.detectChanges();
  }
  
  private calculateNewEndDateTime(newStartDate: string, newStartTime: string, duration: number): { date: string, time: string } {
    if (!newStartDate || !newStartTime || !duration) {
      return { date: '', time: '' };
    }
    
    const startDateTime = new Date(`${newStartDate}T${newStartTime}`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 60 * 1000);
    
    return this.splitDateTime(endDateTime.toISOString());
  }
  
  private shouldShowDurationConfirmModal(): boolean {
    // Mostrar el modal solo si:
    // 1. Ya hay una duración definida mayor a 0
    // 2. Ya hay fecha/hora de inicio y fin definidas
    // 3. No es la primera vez que se está configurando (es decir, estamos editando)
    return (this.task.duration || 0) > 0 && 
           !!this.startDate && !!this.startTime && 
           !!this.endDate && !!this.endTime &&
           (this.isEditing || (!!this.previousStartDate && !!this.previousStartTime));
  }
  
  private adjustReminders(newStartDate: string, newStartTime: string, newEndDate: string, newEndTime: string) {
    if (!this.task.reminders || this.task.reminders.length === 0) return;
    if (!this.originalStartDateTime) return;
    
    // Calcular el desplazamiento en milisegundos basado en el cambio de fecha de inicio
    const newStart = new Date(`${newStartDate}T${newStartTime}`);
    const offset = newStart.getTime() - this.originalStartDateTime.getTime();
    
    // Ajustar cada recordatorio con el mismo desplazamiento
    this.task.reminders = this.task.reminders.map(reminderStr => {
      const reminderDate = new Date(reminderStr + (reminderStr.includes('Z') ? '' : 'Z'));
      const adjustedDate = new Date(reminderDate.getTime() + offset);
      return adjustedDate.toISOString().slice(0, 16);
    });
    
    // Actualizar la fecha de inicio original para futuros ajustes
    this.originalStartDateTime = newStart;
    
    // Forzar la actualización de la vista para recalcular las descripciones
    this.cdr.detectChanges();
  }
  
  /**
   * Copia recordatorios de una tarea fuente ajustándolos para mantener la distancia relativa
   * a las fechas de inicio y fin
   */
  private copyRemindersWithRelativeDistance(
    sourceReminders: string[],
    sourceStart: string,
    sourceEnd: string | null,
    targetStartDate: string,
    targetStartTime: string,
    targetEndDate: string,
    targetEndTime: string
  ): string[] {
    if (!sourceReminders || sourceReminders.length === 0) {
      return [];
    }
    
    if (!sourceStart || !targetStartDate || !targetStartTime || !targetEndDate || !targetEndTime) {
      return [...sourceReminders];
    }
    
    // Convertir fechas a objetos Date
    const sourceStartDate = new Date(sourceStart + (sourceStart.includes('Z') ? '' : 'Z'));
    const sourceEndDate = sourceEnd ? new Date(sourceEnd + (sourceEnd.includes('Z') ? '' : 'Z')) : null;
    const targetStartDateObj = new Date(`${targetStartDate}T${targetStartTime}`);
    const targetEndDateObj = new Date(`${targetEndDate}T${targetEndTime}`);
    
    // Ajustar cada recordatorio manteniendo la distancia relativa
    return sourceReminders.map(reminderStr => {
      const reminderDate = new Date(reminderStr + (reminderStr.includes('Z') ? '' : 'Z'));
      
      // Calcular la distancia relativa al inicio y fin de la tarea fuente
      const distanceFromStart = reminderDate.getTime() - sourceStartDate.getTime();
      
      let adjustedDate: Date;
      
      if (sourceEndDate) {
        // Si hay fecha de fin, determinar la posición del recordatorio
        const distanceFromEnd = reminderDate.getTime() - sourceEndDate.getTime();
        
        if (distanceFromStart < 0) {
          // El recordatorio está antes del inicio, mantener la distancia relativa al inicio
          adjustedDate = new Date(targetStartDateObj.getTime() + distanceFromStart);
        } else if (distanceFromEnd <= 0) {
          // El recordatorio está entre el inicio y el fin (durante el evento), mantener la distancia relativa al inicio
          adjustedDate = new Date(targetStartDateObj.getTime() + distanceFromStart);
        } else {
          // El recordatorio está después del fin, mantener la distancia relativa al fin
          adjustedDate = new Date(targetEndDateObj.getTime() + distanceFromEnd);
        }
      } else {
        // Si no hay fecha de fin, mantener la distancia relativa al inicio
        adjustedDate = new Date(targetStartDateObj.getTime() + distanceFromStart);
      }
      
      return adjustedDate.toISOString().slice(0, 16);
    });
  }
  
  // Preparo los campos de fecha/hora antes de abrir el modal de recordatorios
  prepareTaskDatesForReminders() {
    this.task.start = this.combineDateTime(this.startDate, this.startTime);
    this.task.end = this.combineDateTime(this.endDate, this.endTime);
    this.task.deadline = this.deadlineDate && this.deadlineTime ? this.combineDateTime(this.deadlineDate, this.deadlineTime) : null;
  }
  
  async onTaskNameBlur() {
    // Solo buscar si hay un nombre válido y un proyecto seleccionado
    if (!this.task.name || this.task.name.trim() === '') {
      return;
    }
    
    // Solo buscar si hay un proyecto seleccionado para evitar cruces entre proyectos
    if (!this.task.project) {
      return;
    }
    
    try {
      let matchingTasks: Task[] = [];
      
      // Si hay tareas en el Input, buscar localmente (instantaneo)
      if (this.allTasks && this.allTasks.length > 0) {
        matchingTasks = this.allTasks
          .filter(t => 
            t.project === this.task.project && 
            t.name.trim().toLowerCase() === this.task.name!.trim().toLowerCase()
          )
          .sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt).getTime();
            const dateB = new Date(b.updatedAt || b.createdAt).getTime();
            return dateB - dateA; // Mas reciente primero
          });
      } else {
        // Fallback: buscar en Firestore
        matchingTasks = await this.taskService.getTasksByNameAndProject(
          this.task.name.trim(), 
          this.task.project
        );
      }
      
      // Si hay coincidencias, tomar la más reciente (ya viene ordenada)
      if (matchingTasks.length > 0) {
        const mostRecentTask = matchingTasks[0];
        
        // Copiar los valores: tipo, emoji, descripción, prioridad y duración
        // Solo copiar el tipo si es válido para el proyecto actual
        if (mostRecentTask.type) {
          // Asegurar que los tipos estén cargados
          await this.loadTaskTypes();
          const isValidType = this.selectableTaskTypes.some(t => t.id === mostRecentTask.type);
          if (isValidType) {
            this.task.type = mostRecentTask.type;
          }
        }
        
        if (mostRecentTask.emoji) {
          this.task.emoji = mostRecentTask.emoji;
        }
        
        if (mostRecentTask.description) {
          this.task.description = mostRecentTask.description;
        }
        
        if (mostRecentTask.priority) {
          this.task.priority = mostRecentTask.priority;
        }
        
        if (mostRecentTask.duration) {
          this.task.duration = mostRecentTask.duration;
          
          // Si hay fecha/hora de inicio definidas, ajustar automáticamente la fecha/hora de fin
          if (this.startDate && this.startTime) {
            const newEndDateTime = this.calculateNewEndDateTime(this.startDate, this.startTime, mostRecentTask.duration);
            this.endDate = newEndDateTime.date;
            this.endTime = newEndDateTime.time;
            // Validar las fechas después del ajuste
            this.validateDates();
          }
        }
        
        // Copiar recordatorios si existen, ajustándolos para mantener la distancia relativa
        if (mostRecentTask.reminders && mostRecentTask.reminders.length > 0) {
          // Solo copiar si hay fechas de inicio y fin definidas en ambas tareas
          if (this.startDate && this.startTime && this.endDate && this.endTime && 
              mostRecentTask.start && mostRecentTask.end) {
            this.task.reminders = this.copyRemindersWithRelativeDistance(
              mostRecentTask.reminders,
              mostRecentTask.start,
              mostRecentTask.end,
              this.startDate,
              this.startTime,
              this.endDate,
              this.endTime
            );
          } else {
            // Si no hay fechas completas, copiar sin ajustar
            this.task.reminders = [...mostRecentTask.reminders];
          }
        }
        
        // Forzar actualización de la vista
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Error al buscar tareas por nombre y proyecto:', error);
      // No mostrar error al usuario, solo registrar en consola
    }
  }
  
  /**
   * Maneja el cambio en el campo de duración con debounce
   */
  onDurationChange(newDuration: number | null) {
    const duration = newDuration || 0;
    // Emitir el cambio al subject para aplicar debounce
    this.durationChangeSubject.next(duration);
  }
  
  /**
   * Recalcula la fecha/hora de fin basándose en la fecha/hora de inicio y la duración
   */
  private recalculateEndTimeFromDuration(duration: number) {
    // Solo recalcular si hay fecha/hora de inicio y una duración válida
    if (!this.startDate || !this.startTime || !duration || duration <= 0) {
      return;
    }
    
    // Calcular la nueva fecha/hora de fin
    const newEndDateTime = this.calculateNewEndDateTime(this.startDate, this.startTime, duration);
    
    // Actualizar las fechas de fin
    this.endDate = newEndDateTime.date;
    this.endTime = newEndDateTime.time;
    
    // Sincronizar con el primer fragmento si existe
    this.syncFirstFragmentEnd();
    
    // Validar las fechas después del ajuste
    this.validateDates();
    
    // Forzar actualización de la vista
    this.cdr.detectChanges();
  }
  
  // ============================================
  // MÉTODOS PARA ACCIONES REALIZADAS
  // ============================================
  
  /**
   * Obtiene la hora de inicio para una nueva acción
   * Si no hay acciones, usa la hora de inicio de la tarea
   * Si hay acciones, usa la hora de fin de la última acción
   */
  getNextActionStartTime(): string {
    if (!this.task.actionsPerformed || this.task.actionsPerformed.length === 0) {
      return this.startTime || '00:00';
    }
    const lastAction = this.task.actionsPerformed[this.task.actionsPerformed.length - 1];
    return lastAction.endTime;
  }
  
  /**
   * Calcula la hora de fin sumando minutos a una hora dada
   */
  private addMinutesToTime(time: string, minutes: number): string {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMinutes = totalMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
  }
  
  /**
   * Convierte una hora HH:MM a minutos desde medianoche
   */
  private timeToMinutes(time: string): number {
    const [hours, mins] = time.split(':').map(Number);
    return hours * 60 + mins;
  }
  
  /**
   * Calcula los minutos restantes disponibles para acciones
   */
  getRemainingMinutesForActions(): number {
    if (!this.startTime || !this.endTime) {
      return 0;
    }
    
    const taskStartMinutes = this.timeToMinutes(this.startTime);
    const taskEndMinutes = this.timeToMinutes(this.endTime);
    
    // Calcular duración total de la tarea en minutos
    let totalTaskMinutes = taskEndMinutes - taskStartMinutes;
    // Si la tarea cruza medianoche
    if (totalTaskMinutes < 0) {
      totalTaskMinutes += 24 * 60;
    }
    
    // Calcular minutos ya usados por acciones
    let usedMinutes = 0;
    if (this.task.actionsPerformed && this.task.actionsPerformed.length > 0) {
      const lastAction = this.task.actionsPerformed[this.task.actionsPerformed.length - 1];
      const lastEndMinutes = this.timeToMinutes(lastAction.endTime);
      usedMinutes = lastEndMinutes - taskStartMinutes;
      if (usedMinutes < 0) {
        usedMinutes += 24 * 60;
      }
    }
    
    return totalTaskMinutes - usedMinutes;
  }
  
  /**
   * Verifica si se puede agregar una acción de X minutos
   */
  canAddAction(minutes: number): boolean {
    if (!this.startTime || !this.endTime) {
      return false;
    }
    return this.getRemainingMinutesForActions() >= minutes;
  }
  
  /**
   * Agrega una nueva acción con la duración especificada
   */
  addAction(minutes: number) {
    if (!this.canAddAction(minutes)) {
      return;
    }
    
    if (!this.task.actionsPerformed) {
      this.task.actionsPerformed = [];
    }
    
    const startTime = this.getNextActionStartTime();
    const endTime = this.addMinutesToTime(startTime, minutes);
    
    this.task.actionsPerformed.push({
      startTime: startTime,
      endTime: endTime,
      description: ''
    });
    
    // Forzar actualización de la vista
    this.cdr.detectChanges();
  }
  
  /**
   * Elimina la última acción
   */
  removeLastAction() {
    if (this.task.actionsPerformed && this.task.actionsPerformed.length > 0) {
      this.task.actionsPerformed.pop();
      this.cdr.detectChanges();
    }
  }
  
  /**
   * Actualiza la descripción de una acción
   */
  updateActionDescription(index: number, description: string) {
    if (this.task.actionsPerformed && this.task.actionsPerformed[index]) {
      this.task.actionsPerformed[index].description = description;
    }
  }
  
  /**
   * Formatea el rango de tiempo de una acción para mostrar
   */
  formatActionTimeRange(action: TaskAction): string {
    return `${action.startTime} - ${action.endTime}`;
  }
  
  /**
   * Obtiene el texto del tooltip para los botones deshabilitados
   */
  getActionButtonTooltip(minutes: number): string {
    const remaining = this.getRemainingMinutesForActions();
    if (remaining < minutes) {
      if (remaining <= 0) {
        return 'No hay tiempo restante disponible';
      }
      return `Solo quedan ${remaining} minutos disponibles`;
    }
    return `Agregar acción de ${minutes} minutos`;
  }
} 